// Translation Engine powered by Gemini

const { geminiPool } = require('./geminiPool');
const PostProcessor = require('./postProcessor');

class Translator {
  /**
   * Translates a single chapter with high consistency
   * @param {Object} params
   * @param {string} params.rawTitle
   * @param {string} params.rawText
   * @param {string} params.genre
   * @param {string} params.toneGuidance
   * @param {string} params.glossaryContext
   * @param {string} params.previousSummary
   * @param {Array} params.terms
   * @param {string} params.model
   * @param {string} [params.customApiKey]
   * @returns {Promise<{ translatedTitle: string, translatedText: string, summary: string, issues: Array<string> }>}
   */
  static async translateChapter({
    rawTitle,
    rawText,
    genre = 'Tiên Hiệp',
    toneGuidance = 'Văn phong hào sảng, cổ phong, xưng hô tôn ti rõ ràng',
    glossaryContext = '',
    previousSummary = '',
    terms = [],
    model = 'gemini-2.5-flash',
    customApiKey = null,
    strictMode = false
  }) {
    let systemInstruction = `Bạn là Dịch Giả & Tổng Biên Tập Tiểu Thuyết Chữ Trung - Việt hàng đầu thế giới với hơn 20 năm kinh nghiệm biên dịch tiểu thuyết mạng (Qidian, Zongheng, Jinjiang).

MỤC TIÊU TỐI THƯỢNG:
Dịch văn bản tiếng Trung sang tiếng Việt với độ chính xác và NHẤT QUÁN XƯNG HÔ 100%, câu văn mượt mà, tự nhiên, văn phong thuần thục như tác phẩm xuất bản, hoàn toàn không có cảm giác máy dịch hay convert thô ráp, sẵn sàng xuất bản ngay mà không cần người chỉnh sửa.

CÁC NGUYÊN TẮC BẮT BUỘC TUÂN THỦ:
1. TUÂN THỦ 100% BẢNG NHÂN VẬT & MA TRẬN XƯNG HÔ:
   - Dịch đúng chính xác tên nhân vật được chỉ định trong từ điển (không tự ý đổi chữ hay phiên âm khác).
   - Tuyệt đối tuân thủ ngôi xưng hô của từng cặp nhân vật (ví dụ: sư phụ - đồ nhi, ta - ngươi, tại hạ - các hạ, huynh - muội...).
   - Trong thể loại Tu Tiên / Cổ Đại: KHÔNG BAO GIỜ dùng "tôi - bạn", "anh - em" hay các ngôi hiện đại trừ phi bối cảnh là truyện Đô thị/Hiện đại.
   - Giữ nguyên ngôi xưng từ đầu đến cuối chương, không lộn xộn giữa các câu thoại.

2. CHUẨN MỰC VĂN PHONG VĂN HỌC MẠNG VIỆT NAM:
   - Việt hóa mượt mà các cấu trúc câu tiếng Trung ngược:
     * Chuyển "của hắn đích" ➔ "của hắn"
     * Chuyển "một cái thiếu niên" ➔ "một thiếu niên"
     * Chuyển "thời điểm đó" ➔ "lúc đó / khi ấy"
     * Chuyển "cái kia..." đứng đầu câu cảm thán ➔ diễn đạt tự nhiên theo ngữ cảnh Việt.
   - Giữ nguyên và dùng từ Hán Việt chuẩn xác cho các thuật ngữ võ học, cảnh giới, công pháp, pháp bảo, địa danh.

3. BẮT BUỘC GIỮ NGUYÊN 100% BỐ CỤC ĐOẠN VĂN & XUỐNG DÒNG CỦA BẢN GỐC:
   - Bản gốc có bao nhiêu đoạn văn thì bản dịch phải có bấy nhiêu đoạn văn tương ứng.
   - Mỗi đoạn văn phân cách nhau bằng đúng 1 dòng trống (\\n\\n).
   - Tuyệt đối KHÔNG gộp các đoạn văn, câu thoại ngắn thành một khối chữ dính liền khổng lồ.
   - Lời thoại nhân vật mở đầu bằng dấu ngoặc kép "..." hoặc gạch đầu dòng rõ ràng, ở dòng riêng biệt đúng như bản gốc.

4. ĐỊNH DẠNG ĐẦU RA:
   - Chỉ xuất DUY NHẤT tiêu đề chương và nội dung chương dịch.
   - Dòng 1: Tiêu đề chương dịch (ví dụ: "Chương 1: ...").
   - Dòng 2 trở đi: Nội dung chương dịch giữ nguyên bố cục xuống dòng.
   - KHÔNG thêm bất kỳ câu chào hỏi, lời dẫn, ghi chú của dịch giả.`;

    if (strictMode) {
      systemInstruction += `\n\n5. ĐIỀU KIỆN DỊCH KHẮC PHỤC NGHIÊM NGẶT (CHỐNG NUỐT CHỮ & CHỐNG ẢO GIÁC LẶP TỪ):
- Bản dịch trước đó bị phát hiện lỗi nuốt chữ/tóm tắt hoặc kẹt vòng lặp.
- LẦN NÀY BẠN PHẢI DỊCH ĐẦY ĐỦ 100% TỪNG CÂU TỪNG CHỮ CỦA BẢN GỐC, TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT BẤT KỲ ĐOẠN NÀO!
- Tuyệt đối không lặp lại cụm từ hay câu văn. Đảm bảo bản dịch đầy đủ trọn vẹn.`;
    }

    const userPrompt = `DỊCH CHƯƠNG TIỂU THUYẾT SAU:

【THỂ LOẠI TRUYỆN】: ${genre}
【HƯỚNG DẪN TONE VĂN】: ${toneGuidance}

${previousSummary ? `【TÓM TẮT DIỄN BIẾN CHƯƠNG TRƯỚC (DUY TRÌ MẠCH TRUYỆN)】:\n${previousSummary}\n` : ''}

${glossaryContext ? `【BẢNG QUY TẮC NHÂN VẬT, XƯNG HÔ & THUẬT NGỮ BẮT BUỘC ÁP DỤNG】:\n${glossaryContext}\n` : ''}

【TIÊU ĐỀ GỐC】:
${rawTitle}

【NỘI DUNG GỐC TIẾNG TRUNG (GIỮ NGUYÊN 100% BỐ CỤC XUỐNG DÒNG)】:
${rawText}

Hãy dịch toàn bộ tiêu đề và nội dung trên sang tiếng Việt chuẩn văn học mạng, giữ nguyên từng chỗ xuống dòng!`;

    // Step 1: Call Gemini
    const rawResult = await geminiPool.callGeminiWithRetry({
      prompt: userPrompt,
      systemInstruction,
      model,
      temperature: 0.3,
      providedKey: customApiKey
    });

    // Step 2: Separate Title and Body
    const lines = rawResult.trim().split('\n');
    let translatedTitle = lines[0].replace(/^#+\s*/, '').trim();
    let translatedBody = lines.slice(1).join('\n').trim();

    if (!translatedBody) {
      translatedBody = rawResult.trim();
    }

    // Step 3: Automated Post-processing & QA Guard Audit
    const { text: cleanedBody, issues, chineseCharCount, qaReport } = PostProcessor.process(translatedBody, terms, rawText);
    const cleanedTitle = PostProcessor.autoFix(translatedTitle, terms);

    // Step 4: Extract Chapter Audit & Pronoun Inspector
    let auditData = {
      summary: '',
      characters: [],
      pronounPairs: [],
      consistencyNotes: 'Đồng nhất chuẩn theo bối cảnh'
    };

    try {
      auditData = await this.extractChapterAudit({
        rawText,
        translatedText: cleanedBody.slice(0, 3500),
        genre,
        model,
        providedKey: customApiKey
      });
    } catch (e) {
      console.warn('Lỗi phân tích kiểm tra xưng hô chương:', e.message);
    }

    return {
      translatedTitle: cleanedTitle,
      translatedText: cleanedBody,
      summary: auditData.summary || '',
      pronounAudit: {
        charactersDetected: auditData.characters || [],
        pronounPairs: auditData.pronounPairs || [],
        consistencyNotes: auditData.consistencyNotes || 'Đã kiểm tra'
      },
      newDiscoveredEntities: auditData.characters || [],
      issues,
      chineseCharCount,
      qaReport
    };
  }

  static async extractChapterAudit({ rawText, translatedText, genre = 'Tiên Hiệp', model = 'gemini-2.0-flash', providedKey = null }) {
    const prompt = `Phân tích đoạn trích dịch sau (thể loại ${genre}) và trả về JSON:
1. "summary": Tóm tắt đúng 2 câu diễn biến chính của chương.
2. "characters": Danh sách nhân vật xuất hiện (tên Hán Việt, giới tính, vai vế).
3. "pronounPairs": Các cặp xưng hô thực tế giữa các nhân vật trong chương (người nói, người nghe, người nói xưng là gì, gọi người nghe là gì).

Đoạn văn:
"""
${translatedText}
"""

Trả về JSON duy nhất:
{
  "summary": "...",
  "characters": [
    { "zh": "tên Trung (nếu có)", "vi": "tên Việt", "gender": "Nam/Nữ", "role": "..." }
  ],
  "pronounPairs": [
    { "speaker": "tên nhân vật nói", "listener": "tên nhân vật nghe", "speakerSelf": "ta/tôi/đệ tử...", "speakerCallsOther": "ngươi/sư phụ/cô/chị...", "tone": "kính trọng/thân mật/lạnh lùng" }
  ],
  "consistencyNotes": "Nhất quán 100%"
}`;

    try {
      const resText = await geminiPool.callGeminiWithRetry({
        prompt,
        model,
        temperature: 0.1,
        providedKey
      });

      const jsonMatch = resText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn('Lỗi đọc JSON audit:', err.message);
    }

    return {
      summary: '',
      characters: [],
      pronounPairs: [],
      consistencyNotes: 'Đã hoàn tất kiểm tra'
    };
  }

  /**
   * Proofreads, polishes, and standardizes pronouns in existing Vietnamese draft text
   */
  static async proofreadVietnamese({
    vietnameseText,
    genre = 'Đô Thị / Hiện Đại',
    toneGuidance = '',
    glossaryContext = '',
    terms = [],
    model = 'gemini-3.5-flash-lite',
    customApiKey = null
  }) {
    const systemInstruction = `Bạn là Tổng Biên Tập Viên Tiểu Thuyết hàng đầu Việt Nam với hơn 20 năm kinh nghiệm biên tập văn học mạng.
Nhiệm vụ của bạn: BIÊN TẬP, CHUẨN HÓA ĐẠI TỪ XƯNG HÔ VÀ MƯỢT HÓA BẢN DỊCH TIẾNG VIỆT ĐANG CÓ.

CÁC NGUYÊN TẮC BẮT BUỘC:
1. CHUẨN HÓA 100% XƯNG HÔ VÀ ĐẠI TỪ LỜI DẪN THEO BẢNG QUY TẮC:
   - Sửa lại toàn bộ các chỗ xưng hô bị sai, lộn xộn giữa các nhân vật theo đúng quy định.
   - Sửa đại từ lời kể/dẫn truyện (ngôi thứ 3) theo đúng đại từ quy định cho từng nhân vật (ví dụ: nhân vật A gọi là 'cô', nhân vật B gọi là 'nàng', robot gọi là 'nó').
2. NÂNG CAO CHẤT LƯỢNG VĂN PHONG:
   - Sửa các câu từ convert thô ráp, dịch máy gượng gạo, lỗi lặp từ ("cái kia", "của hắn đích"...) thành tiếng Việt văn học tự nhiên, biểu cảm, cuốn hút.
3. BẢO TOÀN NGUYÊN VẸN NỘI DUNG VÀ BỐ CỤC:
   - Giữ nguyên 100% tình tiết, cốt truyện, tuyệt đối không được tự ý tóm tắt, cắt xén bất kỳ chi tiết hay câu thoại nào.
   - Giữ nguyên từng vị trí xuống dòng, mỗi đoạn văn phân cách nhau bằng một dòng trống (\\n\\n).
4. CHỈ XUẤT DUY NHẤT VĂN BẢN ĐÃ BIÊN TẬP, không kèm lời chào, mở bài hay giải thích.`;

    const userPrompt = `HÃY BIÊN TẬP VÀ SỬA CHUẨN XƯNG HÔ CHO BẢN DỊCH TIẾNG VIỆT DƯỚI ĐÂY:

【THỂ LOẠI】: ${genre}
【HƯỚNG DẪN TONE VĂN】: ${toneGuidance}

${glossaryContext ? `【BẢNG QUY TẮC NHÂN VẬT & XƯNG HÔ BẮT BUỘC ÁP DỤNG】:\n${glossaryContext}\n` : ''}

【VĂN BẢN TIẾNG VIỆT CẦN BIÊN TẬP & SỬA XƯNG HÔ】:
${vietnameseText}

Hãy biên tập lại toàn bộ văn bản trên, sửa đúng 100% xưng hô, mượt mà câu chữ và giữ nguyên bố cục xuống dòng!`;

    const rawResult = await geminiPool.callGeminiWithRetry({
      prompt: userPrompt,
      systemInstruction,
      model,
      temperature: 0.25,
      providedKey: customApiKey
    });

    const { text: cleanedBody, issues, chineseCharCount } = PostProcessor.process(rawResult.trim(), terms);

    return {
      translatedText: cleanedBody,
      issues,
      chineseCharCount
    };
  }

  /**
   * Surgically edits/fixes a specific segment of text with AI without touching the rest of the chapter
   */
  static async targetedFix({
    selectedText,
    instruction = 'Sửa đúng lỗi, mượt hóa câu chữ theo đúng bối cảnh',
    contextSurrounding = '',
    genre = 'Đô Thị / Hiện Đại',
    glossaryContext = '',
    model = 'gemini-3.5-flash-lite',
    customApiKey = null
  }) {
    const systemInstruction = `Bạn là Chuyên Gia Biên Tập & Hiệu Đính Văn Học Mạng hàng đầu.
NHIỆM VỤ: SỬA ĐÚNG VÀ DUY NHẤT ĐOẠN VĂN ĐƯỢC CHỈ ĐỊNH dưới đây theo yêu cầu của biên tập viên.

YÊU CẦU BẮT BUỘC:
1. Sửa chính xác theo chỉ đạo: "${instruction}".
2. Nếu liên quan đến nhân vật/xưng hô, TUÂN THỦ 100% Ma Trận Nhân Vật & Từ Điển được cung cấp.
3. Nếu liên quan đến chữ Hán hoặc cụm từ convert thô, dịch/chuyển ngữ mượt mà sang tiếng Việt thuần thục.
4. Đảm bảo nhịp văn hòa quyện tự nhiên với các câu trước và sau trong tác phẩm.
5. ĐỊNH DẠNG ĐẦU RA: CHỈ TRẢ VỀ DUY NHẤT ĐOẠN VĂN ĐÃ ĐƯỢC SỬA HOÀN CHỈNH. Tuyệt đối KHÔNG kèm theo lời giải thích, câu mở đầu "Dưới đây là..." hay dấu ngoặc kép bọc ngoài không cần thiết.`;

    const userPrompt = `ĐOẠN VĂN CẦN SỬA:
"""
${selectedText}
"""

${contextSurrounding ? `NGỮ CẢNH XUNG QUANH (THAM KHẢO):\n"""\n${contextSurrounding}\n"""\n` : ''}
${glossaryContext ? `QUY TẮC NHÂN VẬT & XƯNG HÔ:\n${glossaryContext}\n` : ''}

YÊU CẦU SỬA: ${instruction}

Hãy trả về duy nhất đoạn văn đã được sửa hoàn chỉnh:`;

    const rawResult = await geminiPool.callGeminiWithRetry({
      prompt: userPrompt,
      systemInstruction,
      model,
      temperature: 0.2,
      providedKey: customApiKey
    });

    let fixed = rawResult.trim();
    if (fixed.startsWith('"""') && fixed.endsWith('"""')) {
      fixed = fixed.slice(3, -3).trim();
    }
    return fixed;
  }
}

module.exports = Translator;
