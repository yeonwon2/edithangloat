// Glossary, Character Matrix and Persona Engine

class GlossaryEngine {
  constructor() {
    this.characters = []; // { id, zh, vi, gender, role, notes }
    this.pronounMatrix = []; // { id, speakerZh, listenerZh, speakerCallsSelf, speakerCallsListener, notes }
    this.terms = []; // { id, zh, vi, category }
  }

  setData({ characters = [], pronounMatrix = [], terms = [] }) {
    this.characters = characters;
    this.pronounMatrix = pronounMatrix;
    this.terms = terms;
  }

  getData() {
    return {
      characters: this.characters,
      pronounMatrix: this.pronounMatrix,
      terms: this.terms
    };
  }

  // Import Vietphrase / QuickTranslator Names.txt format
  // Format: Chinese=Vietnamese or Chinese=Vietnamese#Notes
  importVietphrase(content) {
    const lines = content.split('\n');
    let importedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) continue;

      const [mainPart, notes] = line.split('#');
      const [zh, vi] = mainPart.split('=');

      if (zh && vi) {
        const cleanZh = zh.trim();
        const cleanVi = vi.trim();

        // Check if already exists in terms or characters
        const exists = this.terms.find(t => t.zh === cleanZh) || this.characters.find(c => c.zh === cleanZh);
        if (!exists) {
          this.terms.push({
            id: `term_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            zh: cleanZh,
            vi: cleanVi,
            category: notes ? notes.trim() : 'Vietphrase Import'
          });
          importedCount++;
        }
      }
    }
    return importedCount;
  }

  exportVietphrase() {
    const lines = [];
    lines.push('# === DANH TỪ RIÊNG & NHÂN VẬT (DICHTRUYENPRO) ===');
    for (const char of this.characters) {
      lines.push(`${char.zh}=${char.vi}#Nhân vật (${char.gender || 'chưa rõ'}) - ${char.role || ''}`);
    }
    lines.push('\n# === THUẬT NGỮ & ĐỊA DANH ===');
    for (const term of this.terms) {
      lines.push(`${term.zh}=${term.vi}#${term.category || 'Thuật ngữ'}`);
    }
    return lines.join('\n');
  }

  // Build the prompt context string for Gemini
  buildContextForTranslation(rawChapterText = '') {
    let promptSections = [];

    // 1. Filter characters that actually appear in this chapter
    const matchedChars = this.characters.filter(c => {
      if (!rawChapterText) return true;
      return (c.zh && rawChapterText.includes(c.zh)) || (c.vi && rawChapterText.includes(c.vi));
    });
    const activeChars = rawChapterText ? matchedChars : this.characters.slice(0, 50);

    if (activeChars.length > 0) {
      let charText = '### 1. BẢNG NHÂN VẬT BẮT BUỘC DỊCH CHUẨN TÊN:\n';
      for (const c of activeChars) {
        charText += `- **${c.zh}** ➔ **${c.vi}** | Giới tính: ${c.gender || 'chưa rõ'} | Thân phận: ${c.role || 'Nhân vật'} ${c.notes ? `(${c.notes})` : ''}\n`;
      }
      promptSections.push(charText);
    }

    // 2. Narrative Pronoun Rules (Ngôi xưng thứ 3 trong lời kể/dẫn truyện)
    const charsWithNarrative = this.characters.filter(c => c.narrativePronoun && (!rawChapterText || (c.zh && rawChapterText.includes(c.zh)) || (c.vi && rawChapterText.includes(c.vi))));
    if (charsWithNarrative.length > 0) {
      let narrativeText = '### 2. QUY CHUẨN ĐẠI TỪ LỜI DẪN TRUYỆN (NGÔI THỨ 3 BẮT BUỘC 100% TUÂN THỦ):\n';
      for (const c of charsWithNarrative) {
        narrativeText += `- Nhân vật **${c.vi}** (${c.zh || ''}): Trong lời kể, miêu tả của người dẫn truyện, BẮT BUỘC gọi nhân vật này là "**${c.narrativePronoun}**" (tuyệt đối không nhầm sang ngôi khác).\n`;
      }
      promptSections.push(narrativeText);
    }

    // 3. Pronoun matrix (Lời thoại đối thoại trực tiếp)
    const activePairs = this.pronounMatrix.filter(p => {
      if (!rawChapterText) return true;
      return (p.speakerZh && rawChapterText.includes(p.speakerZh)) ||
             (p.listenerZh && rawChapterText.includes(p.listenerZh));
    });

    if (activePairs.length > 0) {
      let matrixText = '### 3. QUY TẮC XƯNG HÔ ĐỐI THOẠI BẮT BUỘC 100% TUÂN THỦ (TUYỆT ĐỐI KHÔNG ĐỔI NGÔI TÙY TIỆN):\n';
      for (const p of activePairs) {
        matrixText += `- Khi **${p.speakerZh}** nói chuyện với **${p.listenerZh}**:\n`;
        matrixText += `  + Người nói tự xưng: "${p.speakerCallsSelf}"\n`;
        matrixText += `  + Người nói gọi đối phương là: "${p.speakerCallsListener}"\n`;
        if (p.notes) matrixText += `  + Thái độ/Lưu ý: ${p.notes}\n`;
      }
      promptSections.push(matrixText);
    }

    // 4. Terms
    const matchedTerms = this.terms.filter(t => !rawChapterText || rawChapterText.includes(t.zh));
    const activeTerms = rawChapterText ? matchedTerms : this.terms.slice(0, 80);

    if (activeTerms.length > 0) {
      let termText = '### 4. TỪ ĐIỂN THUẬT NGỮ, CẢNH GIỚI, ĐỊA DANH, PHÁP BẢO:\n';
      for (const t of activeTerms) {
        termText += `- **${t.zh}** ➔ **${t.vi}** [${t.category || 'Thuật ngữ'}]\n`;
      }
      promptSections.push(termText);
    }

    return promptSections.join('\n\n');
  }

  // AI Scan prompt generation to auto-detect entities from raw sample
  static getScanPrompt(sampleText, genre = 'Tiên Hiệp') {
    return `Bạn là chuyên gia phân tích văn bản tiểu thuyết Trung Quốc và biên tập dịch thuật tiếng Việt hàng đầu.
Nhiệm vụ: Hãy phân tích đoạn văn bản tiểu thuyết sau (thể loại: ${genre}), trích xuất toàn bộ:
1. Danh sách Nhân vật: Tên tiếng Trung, Phiên âm Hán Việt chuẩn, Giới tính, Vai vế/Thân phận, và ghi chú.
2. Ma trận Xưng hô: Giữa các cặp nhân vật tương tác với nhau (Người nói xưng gì, gọi người nghe là gì phù hợp hoàn hảo với thể loại ${genre}).
3. Thuật ngữ quan trọng: Tông môn, cảnh giới, pháp bảo, chiêu thức, địa danh.

Đoạn văn bản mẫu:
"""
${sampleText.slice(0, 8000)}
"""

Hãy trả về kết quả ĐÚNG ĐỊNH DẠNG JSON sau (không kèm lời giải thích nào khác ngoài JSON):
{
  "characters": [
    { "zh": "tên Trung", "vi": "tên Hán Việt", "gender": "Nam/Nữ", "role": "nhân vật chính / đệ tử / sư tôn...", "notes": "ghi chú thêm" }
  ],
  "pronounMatrix": [
    { "speakerZh": "tên Trung người nói", "listenerZh": "tên Trung người nghe", "speakerCallsSelf": "ta/đệ tử/vi sư...", "speakerCallsListener": "ngươi/sư phụ/sư muội...", "notes": "kính trọng/thân mật/thù địch" }
  ],
  "terms": [
    { "zh": "từ Trung", "vi": "dịch Hán Việt chuẩn", "category": "Cảnh giới / Tông môn / Chiêu thức / Địa danh" }
  ]
}`;
  }
}

module.exports = GlossaryEngine;
