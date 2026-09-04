import JSZip from 'jszip';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';

const titleOf = (chapter, index) => chapter.translatedTitle || chapter.title || `Chương ${index + 1}`;
const safeName = value => String(value || 'truyen').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 100) || 'truyen';
const xml = value => String(value || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportProject(project, format) {
  const chapters = (project?.chapters || [])
    .filter(chapter => chapter.translatedText || chapter.status === 'completed')
    .sort((a, b) => Number(a.chapterIndex || 0) - Number(b.chapterIndex || 0));
  if (!chapters.length) throw new Error('Chưa có chương nào được dịch.');
  const bookName = safeName(project.title);

  if (format === 'txt') {
    const text = chapters.map((chapter, index) => `${titleOf(chapter, index)}\n\n${chapter.translatedText || ''}`).join('\n\n\n');
    save(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }), `${bookName}.txt`);
    return;
  }

  if (format === 'zip') {
    const zip = new JSZip();
    chapters.forEach((chapter, index) => {
      const number = String(index + 1).padStart(4, '0');
      zip.file(`${number}_${safeName(titleOf(chapter, index))}.txt`, `\ufeff${titleOf(chapter, index)}\n\n${chapter.translatedText || ''}`);
    });
    save(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${bookName}_chapters.zip`);
    return;
  }

  if (format === 'docx') {
    const children = [new Paragraph({ text: project.title || 'Truyện', heading: HeadingLevel.TITLE })];
    chapters.forEach((chapter, index) => {
      children.push(new Paragraph({ text: titleOf(chapter, index), heading: HeadingLevel.HEADING_1, pageBreakBefore: index > 0 }));
      String(chapter.translatedText || '').split(/\r?\n/).filter(line => line.trim()).forEach(line => children.push(new Paragraph(line.trim())));
    });
    save(await Packer.toBlob(new Document({ sections: [{ children }] })), `${bookName}.docx`);
    return;
  }

  if (format === 'epub') {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    const manifest = chapters.map((_, index) => `<item id="c${index + 1}" href="chapter_${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('');
    const spine = chapters.map((_, index) => `<itemref idref="c${index + 1}"/>`).join('');
    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${xml(project.title)}</dc:title><dc:language>vi</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest}</manifest><spine>${spine}</spine></package>`);
    const nav = chapters.map((chapter, index) => `<li><a href="chapter_${index + 1}.xhtml">${xml(titleOf(chapter, index))}</a></li>`).join('');
    zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Mục lục</title></head><body><nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><ol>${nav}</ol></nav></body></html>`);
    chapters.forEach((chapter, index) => {
      const paragraphs = String(chapter.translatedText || '').split(/\r?\n/).filter(line => line.trim()).map(line => `<p>${xml(line.trim())}</p>`).join('');
      zip.file(`OEBPS/chapter_${index + 1}.xhtml`, `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(titleOf(chapter, index))}</title></head><body><h1>${xml(titleOf(chapter, index))}</h1>${paragraphs}</body></html>`);
    });
    save(await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' }), `${bookName}.epub`);
    return;
  }

  throw new Error('Định dạng xuất không được hỗ trợ.');
}
