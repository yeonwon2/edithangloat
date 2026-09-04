const archiver = require('archiver');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const { Readable } = require('stream');

function createZipArchive(options = { zlib: { level: 9 } }) {
  if (typeof archiver === 'function') {
    return archiver('zip', options);
  }
  if (archiver.ZipArchive) {
    return new archiver.ZipArchive(options);
  }
  if (archiver.default && typeof archiver.default === 'function') {
    return archiver.default('zip', options);
  }
  throw new Error('Không thể khởi tạo module nén Zip');
}

class ExportService {
  /**
   * Export all chapters into a single TXT file
   */
  static exportMergedTxt(novelTitle, chapters) {
    let content = `======================================================\n`;
    content += `   ${novelTitle.toUpperCase()}\n`;
    content += `   Tổng số chương: ${chapters.length}\n`;
    content += `   Dịch tự động bởi DichTruyenPro (Gemini AI)\n`;
    content += `======================================================\n\n\n`;

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const title = ch.translatedTitle || ch.title || `Chương ${i + 1}`;
      const body = ch.translatedText || ch.originalText || '';

      content += `------------------------------------------------------\n`;
      content += `${title}\n`;
      content += `------------------------------------------------------\n\n`;
      content += `${body}\n\n\n`;
    }

    return Buffer.from(content, 'utf-8');
  }

  /**
   * Export individual chapters in a ZIP archive
   */
  static async exportZip(novelTitle, chapters) {
    return new Promise((resolve, reject) => {
      const archive = createZipArchive({ zlib: { level: 9 } });
      const buffers = [];

      archive.on('data', data => buffers.push(data));
      archive.on('end', () => resolve(Buffer.concat(buffers)));
      archive.on('error', err => reject(err));

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const num = String(i + 1).padStart(4, '0');
        const safeTitle = (ch.translatedTitle || ch.title || `Chuong_${i + 1}`)
          .replace(/[/\\?%*:|"<>]/g, '-')
          .slice(0, 50);

        const filename = `${num}_${safeTitle}.txt`;
        const content = `${ch.translatedTitle || ch.title}\n\n${ch.translatedText || ch.originalText || ''}`;
        archive.append(content, { name: filename });
      }

      archive.finalize();
    });
  }

  /**
   * Export as Word DOCX document
   */
  static async exportDocx(novelTitle, chapters) {
    const docChildren = [];

    // Book Title
    docChildren.push(
      new Paragraph({
        text: novelTitle,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 }
      })
    );

    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Tổng số: ${chapters.length} chương | Dịch bởi DichTruyenPro`,
            italics: true,
            color: '666666'
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      })
    );

    // Chapters
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const title = ch.translatedTitle || ch.title || `Chương ${i + 1}`;
      const body = ch.translatedText || ch.originalText || '';

      // Chapter Heading
      docChildren.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: i > 0,
          spacing: { before: 400, after: 200 }
        })
      );

      // Paragraphs
      const paragraphs = body.split('\n').filter(p => p.trim());
      for (const p of paragraphs) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: p.trim(), size: 24 })], // 12pt
            spacing: { after: 120, line: 360 } // 1.5 line spacing
          })
        );
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children: docChildren }]
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Export valid EPUB 3 ebook file
   */
  static async exportEpub(novelTitle, chapters, author = 'DichTruyenPro') {
    return new Promise((resolve, reject) => {
      const archive = createZipArchive({ zlib: { level: 9 } });
      const buffers = [];

      archive.on('data', data => buffers.push(data));
      archive.on('end', () => resolve(Buffer.concat(buffers)));
      archive.on('error', err => reject(err));

      // 1. mimetype (must be uncompressed)
      archive.append('application/epub+zip', { name: 'mimetype', store: true });

      // 2. META-INF/container.xml
      const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
      archive.append(containerXml, { name: 'META-INF/container.xml' });

      // Build manifest and spine for OEBPS/content.opf
      let manifestItems = `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n`;
      manifestItems += `    <item id="style" href="style.css" media-type="text/css"/>\n`;
      let spineItems = '';
      let ncxNavPoints = '';

      for (let i = 0; i < chapters.length; i++) {
        const id = `chapter_${i + 1}`;
        manifestItems += `    <item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>\n`;
        spineItems += `    <itemref idref="${id}"/>\n`;

        const title = escapeXml(chapters[i].translatedTitle || chapters[i].title || `Chương ${i + 1}`);
        ncxNavPoints += `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${title}</text></navLabel>
      <content src="${id}.xhtml"/>
    </navPoint>\n`;
      }

      // 3. OEBPS/content.opf
      const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(novelTitle)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>vi</dc:language>
    <dc:identifier id="BookId">urn:uuid:${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
${manifestItems}  </manifest>
  <spine toc="ncx">
${spineItems}  </spine>
</package>`;
      archive.append(contentOpf, { name: 'OEBPS/content.opf' });

      // 4. OEBPS/toc.ncx
      const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(novelTitle)}</text></docTitle>
  <navMap>
${ncxNavPoints}  </navMap>
</ncx>`;
      archive.append(tocNcx, { name: 'OEBPS/toc.ncx' });

      // 5. OEBPS/style.css
      const css = `body { font-family: sans-serif; line-height: 1.6; padding: 1em; color: #222; }
h1 { font-size: 1.4em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; margin-bottom: 1em; text-align: center; }
p { text-indent: 1.5em; margin: 0.5em 0; text-align: justify; }`;
      archive.append(css, { name: 'OEBPS/style.css' });

      // 6. Each Chapter XHTML
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const title = ch.translatedTitle || ch.title || `Chương ${i + 1}`;
        const body = ch.translatedText || ch.originalText || '';

        const paragraphs = body
          .split('\n')
          .filter(p => p.trim())
          .map(p => `    <p>${escapeXml(p.trim())}</p>`)
          .join('\n');

        const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
${paragraphs}
</body>
</html>`;
        archive.append(xhtml, { name: `OEBPS/chapter_${i + 1}.xhtml` });
      }

      archive.finalize();
    });
  }
}

function escapeXml(unsafe) {
  return (unsafe || '')
    .replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
}

module.exports = ExportService;
