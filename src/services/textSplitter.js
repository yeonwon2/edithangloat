class TextSplitter {
  /**
   * Split raw text into chapters
   * @param {string} fullText - Entire novel text
   * @param {object} options - { singleChapter: boolean, customTitle: string }
   * @returns {Array<{ index: number, title: string, originalText: string, wordCount: number }>}
   */
  static splitIntoChapters(fullText, options = {}) {
    if (!fullText || typeof fullText !== 'string') return [];

    // Normalize newlines
    const text = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // If caller specifically requested to keep as single chapter:
    if (options.singleChapter) {
      const lines = text.trim().split('\n');
      const firstLine = lines[0].trim();
      const isShortTitle = firstLine.length <= 60 && !firstLine.includes('，') && !firstLine.includes('。');
      return [{
        index: 1,
        title: isShortTitle ? firstLine : (options.customTitle || 'Chương 1'),
        originalText: isShortTitle ? lines.slice(1).join('\n').trim() : text.trim(),
        wordCount: this.countWords(text)
      }];
    }

    // Regex matching chapter headers:
    // 1. 第1章, 第一章, 第 123 章, 第十二回, 第一卷, etc.
    // 2. Chương 1, Chương 01, Hồi 1, Tiết 1, etc.
    // 3. Chapter 1, Chap 1, etc.
    const chapterRegex = /(?:^|\n)\s*(第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节卷集部][^\n]*|(?:Chương|Hồi|Tiết|Quyển|Chapter|Chap)\s+[0-9一二三四五六七八九十百千万零两]+[^\n]*)/gi;

    const matches = [];
    let match;

    while ((match = chapterRegex.exec(text)) !== null) {
      matches.push({
        title: match[1].trim(),
        startIndex: match.index + (match[0].startsWith('\n') ? 1 : 0),
        headerLength: match[0].length
      });
    }

    // Fallback: If no chapter headers were detected:
    // Keep as 1 single chapter unless text is extraordinarily large (> 15,000 words)
    if (matches.length === 0) {
      const totalWords = this.countWords(text);
      if (totalWords <= 15000) {
        const lines = text.trim().split('\n');
        const firstLine = lines[0].trim();
        const isShortTitle = firstLine.length <= 60 && !firstLine.includes('，') && !firstLine.includes('。');
        return [{
          index: 1,
          title: isShortTitle ? firstLine : 'Chương 1',
          originalText: isShortTitle ? lines.slice(1).join('\n').trim() : text.trim(),
          wordCount: totalWords
        }];
      }
      return this.fallbackSplit(text, 10000);
    }

    const chapters = [];

    // If there is prologue / intro text before Chapter 1
    if (matches[0].startIndex > 100) {
      const introText = text.slice(0, matches[0].startIndex).trim();
      if (introText.length > 50) {
        chapters.push({
          index: 1,
          title: 'Tiền truyện / Mở đầu',
          originalText: introText,
          wordCount: this.countWords(introText)
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const bodyStartIndex = current.startIndex;
      const bodyEndIndex = next ? next.startIndex : text.length;

      let chapterContent = text.slice(bodyStartIndex, bodyEndIndex).trim();

      // Clean redundant title inside body if it duplicates
      const lines = chapterContent.split('\n');
      const titleLine = lines[0].trim();
      const bodyText = lines.slice(1).join('\n').trim();

      chapters.push({
        index: chapters.length + 1,
        title: titleLine || current.title,
        originalText: bodyText || chapterContent,
        wordCount: this.countWords(bodyText || chapterContent)
      });
    }

    return chapters;
  }

  static fallbackSplit(text, targetWordCount = 2000) {
    const paragraphs = text.split(/\n\s*\n/);
    const chapters = [];
    let currentChapterParagraphs = [];
    let currentWords = 0;
    let chapterIndex = 1;

    for (const p of paragraphs) {
      const pWords = this.countWords(p);
      currentChapterParagraphs.push(p);
      currentWords += pWords;

      if (currentWords >= targetWordCount) {
        const chapterBody = currentChapterParagraphs.join('\n\n').trim();
        chapters.push({
          index: chapterIndex,
          title: `Phần ${chapterIndex}`,
          originalText: chapterBody,
          wordCount: this.countWords(chapterBody)
        });
        chapterIndex++;
        currentChapterParagraphs = [];
        currentWords = 0;
      }
    }

    if (currentChapterParagraphs.length > 0) {
      const chapterBody = currentChapterParagraphs.join('\n\n').trim();
      chapters.push({
        index: chapterIndex,
        title: `Phần ${chapterIndex}`,
        originalText: chapterBody,
        wordCount: this.countWords(chapterBody)
      });
    }

    return chapters;
  }

  static countWords(str) {
    if (!str) return 0;
    // For Chinese characters + Vietnamese/Latin words
    // Match Hanzi individually or word sequences for Latin
    const hanzi = str.match(/[\u4e00-\u9fa5]/g) || [];
    const latinWords = str.replace(/[\u4e00-\u9fa5]/g, ' ').trim().split(/\s+/).filter(Boolean);
    return hanzi.length + latinWords.length;
  }
}

module.exports = TextSplitter;
