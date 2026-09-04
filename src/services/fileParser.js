const mammoth = require('mammoth');
const AdmZip = require('adm-zip');

class FileParser {
  /**
   * Extract raw text from various file formats (.txt, .docx, .epub, .pdf, .zip)
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @returns {Promise<string>} Clean text
   */
  static async extractText(buffer, originalName = '') {
    const ext = (originalName.split('.').pop() || '').toLowerCase();

    switch (ext) {
      case 'docx':
      case 'doc':
        return await this.extractFromDocx(buffer);

      case 'pdf':
        return await this.extractFromPdf(buffer);

      case 'epub':
        return await this.extractFromEpub(buffer);

      case 'zip':
        return await this.extractFromZip(buffer);

      case 'txt':
      default:
        return this.extractFromTxt(buffer);
    }
  }

  static extractFromTxt(buffer) {
    // Try utf-8
    let text = buffer.toString('utf-8');
    // If text contains lots of replacement chars , could be GBK or UTF-16
    if (text.includes('\uFFFD')) {
      try {
        const iconv = require('util');
        // fallback
      } catch (e) {}
    }
    return text;
  }

  static async extractFromDocx(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (err) {
      throw new Error(`Không thể đọc file Word (.docx): ${err.message}`);
    }
  }

  static async extractFromPdf(buffer) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err) {
      throw new Error(`Không thể đọc file PDF: ${err.message}`);
    }
  }

  static async extractFromEpub(buffer) {
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      // Filter html/xhtml chapters
      const chapterEntries = zipEntries.filter(entry => {
        const name = entry.entryName.toLowerCase();
        return (name.endsWith('.xhtml') || name.endsWith('.html') || name.endsWith('.htm')) &&
               !name.includes('nav.') && !name.includes('toc.') && !name.includes('cover.');
      });

      // Sort chapters logically by filename or path
      chapterEntries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

      let fullText = '';
      for (const entry of chapterEntries) {
        const content = entry.getData().toString('utf-8');
        // Clean html tags to text preserving paragraph breaks
        const cleaned = content
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<h[1-6][^>]*>/gi, '\n\n')
          .replace(/<\/h[1-6]>/gi, '\n\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();

        if (cleaned.length > 20) {
          fullText += cleaned + '\n\n';
        }
      }

      if (!fullText.trim()) {
        // Fallback: read all files inside epub
        for (const entry of zipEntries) {
          if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
            const content = entry.getData().toString('utf-8').replace(/<[^>]+>/g, ' ').trim();
            fullText += content + '\n\n';
          }
        }
      }

      return fullText.trim();
    } catch (err) {
      throw new Error(`Không thể đọc file EPUB: ${err.message}`);
    }
  }

  static async extractFromZip(buffer) {
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      let fullText = '';

      const textEntries = zipEntries.filter(entry => entry.entryName.endsWith('.txt'));
      textEntries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

      for (const entry of textEntries) {
        fullText += entry.getData().toString('utf-8') + '\n\n';
      }

      return fullText.trim();
    } catch (err) {
      throw new Error(`Không thể đọc file ZIP: ${err.message}`);
    }
  }
}

module.exports = FileParser;
