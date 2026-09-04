// Automated Quality Assurance (QA) Guard, Linter & 1-Click Post-Processor for Web Novels

class PostProcessor {
  /**
   * Universal Chinese to Vietnamese punctuation map
   */
  static PUNCT_MAP = {
    '，': ', ',
    '。': '. ',
    '！': '! ',
    '？': '? ',
    '：': ': ',
    '；': '; ',
    '（': ' (',
    '）': ') ',
    '【': ' [',
    '】': '] ',
    '《': ' "',
    '》': '" ',
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '…': '...',
    '——': ' — ',
    '—': ' — '
  };

  /**
   * 30+ Common raw convert / machine translation artifacts
   */
  static CONVERT_ARTIFACTS = [
    { pattern: /\bcái kia\b/gi, replace: 'kia', note: 'Giảm lặp từ "cái kia"' },
    { pattern: /\bmột cái (nam tử|thiếu niên|lão giả|thiếu nữ|hài tử|người|cô gái|chàng trai|tiểu cô nương)\b/gi, replace: 'một $1', note: 'Bỏ "cái" trước danh từ chỉ người' },
    { pattern: /\b(hắn|nàng|ta|ngươi|họ) đích\b/gi, replace: 'của $1', note: 'Sửa lỗi dịch thô "đích"' },
    { pattern: /\bthời điểm đó\b/gi, replace: 'lúc đó', note: 'Mượt hóa "thời điểm đó"' },
    { pattern: /\btrong lúc nhất thời\b/gi, replace: 'nhất thời', note: 'Mượt hóa "trong lúc nhất thời"' },
    { pattern: /\bhướng về phía\b/gi, replace: 'về phía', note: 'Giảm rườm rà "hướng về phía"' },
    { pattern: /\bhướng phía\b/gi, replace: 'phía', note: 'Mượt hóa "hướng phía"' },
    { pattern: /\bhướng tới\b/gi, replace: 'về phía', note: 'Mượt hóa "hướng tới"' },
    { pattern: /\bđối với việc này\b/gi, replace: 'về việc này', note: 'Mượt hóa "đối với việc này"' },
    { pattern: /\bkhông khỏi thầm nghĩ\b/gi, replace: 'thầm nghĩ', note: 'Mượt hóa "không khỏi thầm nghĩ"' },
    { pattern: /\bkhông khỏi có chút\b/gi, replace: 'có chút', note: 'Mượt hóa "không khỏi có chút"' },
    { pattern: /\bhơi hơi\b/gi, replace: 'hơi', note: 'Sửa lỗi lặp convert "hơi hơi"' },
    { pattern: /\bnhẹ nhàng nở nụ cười\b/gi, replace: 'khẽ mỉm cười', note: 'Mượt hóa câu cười' },
    { pattern: /\bkhóe miệng khẽ nhếch\b/gi, replace: 'khóe môi khẽ cong', note: 'Văn phong văn học' },
    { pattern: /\bđem (hắn|nàng|y|ngươi|ta|nó) (đánh|giết|kéo|ôm|đẩy|ném|bắt)\b/gi, replace: '$2 $1', note: 'Đảo ngược cấu trúc câu chữ Đem (把)' },
    { pattern: /[^\S\r\n]{2,}/g, replace: ' ', note: 'Xóa khoảng trắng thừa' },
    { pattern: /[^\S\r\n]+([,.\?!;])/g, replace: '$1', note: 'Xóa khoảng trắng trước dấu câu' }
  ];

  /**
   * AI chatter & meta patterns (Prompt leakage)
   */
  static AI_META_PATTERNS = [
    /^(dưới đây là bản dịch|đây là bản dịch|sau đây là bản dịch|bản dịch tiếng việt:?|dịch chương:?).*$/gim,
    /^(chúc bạn đọc truyện vui vẻ|hy vọng bản dịch này|nếu có thắc mắc gì).*$/gim,
    /^(lời người dịch|dịch giả chú thích|ghi chú của dịch giả|chú thích:?).*$/gim,
    /^(as an ai language model|here is the translation|certainly,? here is|sure,? here is).*$/gim,
    /^\s*\(\s*(hết chương|còn tiếp|to be continued)\s*\)\s*$/gim
  ];

  /**
   * Comprehensive Quality Audit
   * Evaluates text across 7 dimensions and returns actionable verdict
   */
  static audit(translatedText, rawText = '', context = {}) {
    const text = (translatedText || '').normalize('NFC').trim();
    const raw = (rawText || '').trim();
    const characters = context.characters || [];
    const pronounMatrix = context.pronounMatrix || [];
    const terms = context.terms || [];

    const issues = [];
    let deduction = 0;

    const viWords = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const rawLen = raw.length;

    // 1. Kiểm tra Sót chữ Hán
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const uniqueChinese = Array.from(new Set(chineseChars));
    if (chineseChars.length > 0) {
      const isCritical = chineseChars.length > 5;
      deduction += isCritical ? 25 : 10;
      const snippetMatch = text.match(/[^.!?\n]{0,45}[\u4e00-\u9fa5]+[^.!?\n]{0,45}/);
      const targetSnippet = snippetMatch ? snippetMatch[0].trim() : uniqueChinese.slice(0, 5).join(', ');
      issues.push({
        id: `iss_ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'chinese',
        severity: isCritical ? 'critical' : 'warning',
        message: `Sót ${chineseChars.length} chữ Hán chưa dịch: [ ${uniqueChinese.slice(0, 10).join(', ')}${uniqueChinese.length > 10 ? '...' : ''} ]`,
        targetSnippet,
        instruction: `Dịch đúng nghĩa toàn bộ các chữ Hán trong câu này sang tiếng Việt chuẩn, không sót chữ nào: "${targetSnippet}"`,
        actionType: 'ai_fix',
        fixable: true
      });
    }

    // 2. Kiểm tra Độ Dài & Nuốt Chữ (Truncation)
    let lengthRatio = 1.0;
    if (rawLen > 300) {
      lengthRatio = viWords / (rawLen * 0.7); // Tiếng Trung 1 ký tự ~ 0.7 - 0.9 từ tiếng Việt
      if (lengthRatio < 0.35) {
        deduction += 45;
        issues.push({
          id: `iss_trunc_${Date.now()}`,
          type: 'truncation',
          severity: 'critical',
          message: `CẢNH BÁO NUỐT CHỮ: Bản Raw có ${rawLen} ký tự nhưng bản dịch chỉ có ${viWords} từ (thiếu >60% nội dung). AI đã tóm tắt hoặc bỏ dở chương!`,
          fixable: false,
          recommendRetranslate: true
        });
      } else if (lengthRatio < 0.6) {
        deduction += 15;
        issues.push({
          id: `iss_trunc_warn_${Date.now()}`,
          type: 'truncation',
          severity: 'warning',
          message: `Bản dịch hơi ngắn bất thường so với Raw (${viWords} từ / ${rawLen} ký tự raw). Hãy kiểm tra xem có bị sót đoạn cuối không.`,
          fixable: false
        });
      }
    }

    // 3. Kiểm tra Vòng Lặp Ảo Giác AI (Loop Hallucination)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let hasLoop = false;
    let loopSample = '';
    const lineCount = {};
    for (const line of lines) {
      if (line.length > 15) {
        lineCount[line] = (lineCount[line] || 0) + 1;
        if (lineCount[line] >= 3) {
          hasLoop = true;
          loopSample = line.slice(0, 40) + '...';
          break;
        }
      }
    }

    // Regex check for repeated consecutive phrases: e.g. "abc abc abc abc"
    const phraseLoopMatch = text.match(/(.{5,40})\s+\1\s+\1\s+\1/i);
    if (hasLoop || phraseLoopMatch) {
      deduction += 40;
      const snippet = loopSample || (phraseLoopMatch ? phraseLoopMatch[1] : '');
      issues.push({
        id: `iss_loop_${Date.now()}`,
        type: 'loop',
        severity: 'critical',
        message: `ẢO GIÁC LẶP TỪ: AI bị kẹt vòng lặp lặp đi lặp lại cụm từ: "${snippet}". Khuyên dịch lại ngay!`,
        targetSnippet: snippet,
        actionType: 'retranslate',
        fixable: true,
        recommendRetranslate: true
      });
    }

    // 4. Kiểm tra Rác AI / Lời Dẫn Ngoài Luồng
    let aiMetaCount = 0;
    let sampleMeta = '';
    for (const pattern of this.AI_META_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        aiMetaCount += match.length;
        if (!sampleMeta) sampleMeta = match[0].trim();
      }
    }
    if (aiMetaCount > 0) {
      deduction += 15;
      issues.push({
        id: `iss_meta_${Date.now()}`,
        type: 'ai_meta',
        severity: 'warning',
        message: `Phát hiện ${aiMetaCount} câu rác của AI ("Dưới đây là bản dịch...", "Lời dịch giả...",...).`,
        targetSnippet: sampleMeta,
        actionType: 'auto_fix',
        fixable: true
      });
    }

    // 5. Kiểm tra Cụm Từ Convert Thô
    let convertArtifactCount = 0;
    let sampleConvert = '';
    for (const item of this.CONVERT_ARTIFACTS) {
      const match = text.match(item.pattern);
      if (match) {
        convertArtifactCount += match.length;
        if (!sampleConvert) {
          const sent = text.match(new RegExp(`[^.!?\\n]{0,40}${item.pattern.source}[^.!?\\n]{0,40}`, 'i'));
          if (sent) sampleConvert = sent[0].trim();
        }
      }
    }
    if (convertArtifactCount > 3) {
      deduction += Math.min(15, convertArtifactCount * 2);
      issues.push({
        id: `iss_conv_${Date.now()}`,
        type: 'convert',
        severity: 'warning',
        message: `Có ${convertArtifactCount} cụm từ convert thô ("cái kia", "thời điểm đó", "đích",...).`,
        targetSnippet: sampleConvert,
        instruction: 'Mượt hóa các câu dính convert thô này sang văn phong tự nhiên, trôi chảy',
        actionType: 'ai_fix',
        fixable: true
      });
    }

    // 6. Kiểm tra Dấu Ngoặc Kép Thoại (Unclosed Quotes)
    const quoteCount = (text.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      deduction += 10;
      issues.push({
        id: `iss_quote_${Date.now()}`,
        type: 'punctuation',
        severity: 'warning',
        message: `Dấu ngoặc kép không cân xứng (lẻ ${quoteCount} dấu "). Một câu thoại đang bị mở ngoặc mà không đóng.`,
        actionType: 'auto_fix',
        fixable: true
      });
    }

    // 7. Kiểm tra Lệch Xưng Hô Nhân Vật
    if (characters.length > 0) {
      for (const c of characters) {
        if (c.gender === 'Nữ' && (c.narrativePronoun === 'nàng' || c.narrativePronoun === 'cô')) {
          // Check if female protagonist is mistakenly referred to as "hắn" or "y"
          const wrongPronounRegex = new RegExp(`([^.!?\\n]{0,50}\\b${c.vi}\\b[^.!?\\n]{0,50}\\b(hắn|y)\\b[^.!?\\n]{0,50})`, 'i');
          const prnMatch = text.match(wrongPronounRegex);
          if (prnMatch) {
            deduction += 12;
            const targetSnippet = prnMatch[0].trim();
            issues.push({
              id: `iss_prn_${Date.now()}_${c.vi}`,
              type: 'pronoun',
              severity: 'warning',
              message: `Nhân vật nữ ${c.vi} (quy định dẫn truyện là "${c.narrativePronoun}") có đoạn bị nhầm gọi thành "hắn".`,
              targetSnippet,
              instruction: `Đổi ngôi xưng/dẫn truyện của nhân vật ${c.vi} thành "${c.narrativePronoun}", tuyệt đối không dùng "hắn" hay "y" trong câu này: "${targetSnippet}"`,
              actionType: 'ai_fix',
              fixable: true,
              recommendProofread: true
            });
            break;
          }
        }
      }
    }

    // Calculate Final Score (0 - 100)
    const score = Math.max(0, Math.min(100, 100 - deduction));

    let status = 'excellent';
    let recommendation = 'ready';
    let recommendationText = 'Bản dịch đạt chuẩn xuất bản 100%! Không phát hiện lỗi đáng kể.';

    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasFixable = issues.some(i => i.fixable);
    const recommendRetranslate = issues.some(i => i.recommendRetranslate);
    const recommendProofread = issues.some(i => i.recommendProofread);

    if (recommendRetranslate || score < 60) {
      status = 'critical';
      recommendation = 'retranslate_recommended';
      recommendationText = 'Khuyên Dịch Lại Ngay: Phát hiện lỗi nghiêm trọng (nuốt chữ hoặc vòng lặp). Hãy bấm "Dịch Lại Khắc Phục".';
    } else if (recommendProofread) {
      status = 'warning';
      recommendation = 'proofread_needed';
      recommendationText = 'Khuyên bấm nút "⚡ Sửa Chuẩn Xưng Hô" để AI đồng nhất lại xưng hô nhân vật theo ma trận.';
    } else if (hasFixable || score < 95) {
      status = 'good';
      recommendation = 'auto_fixable';
      recommendationText = 'Chất lượng tốt. Bạn có thể bấm "🛠️ Sửa Nhanh 1-Click" để tự động dọn rác, đóng ngoặc kép và mượt câu.';
    }

    return {
      score,
      status, // 'excellent' | 'good' | 'warning' | 'critical'
      recommendation, // 'ready' | 'auto_fixable' | 'proofread_needed' | 'retranslate_recommended'
      recommendationText,
      issues,
      stats: {
        viWordCount: viWords,
        rawCharCount: rawLen,
        lengthRatio: parseFloat(lengthRatio.toFixed(2)),
        chineseCharCount: chineseChars.length,
        aiMetaCount,
        convertArtifactCount,
        quoteBalanced: quoteCount % 2 === 0
      }
    };
  }

  /**
   * 1-Click Instant Auto-Fix
   * Repairs punctuation, closes quotes, cleans convert artifacts, strips AI chatter in 2ms without AI cost
   */
  static autoFix(text, terms = []) {
    if (!text) return '';
    let cleaned = (text || '').normalize('NFC');

    // 1. Strip AI chatter lines
    for (const pattern of this.AI_META_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    // 2. Remove immediate duplicate loop repetitions (3+ identical consecutive lines)
    const lines = cleaned.split('\n');
    const filteredLines = [];
    let repeatCount = 0;
    let prevLine = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed === prevLine) {
        repeatCount++;
        if (repeatCount < 2) {
          filteredLines.push(line);
        }
      } else {
        repeatCount = 0;
        prevLine = trimmed;
        filteredLines.push(line);
      }
    }
    cleaned = filteredLines.join('\n');

    // 3. Convert Chinese full-width punctuations to standard Vietnamese
    for (const [chPunct, viPunct] of Object.entries(this.PUNCT_MAP)) {
      cleaned = cleaned.replaceAll(chPunct, viPunct);
    }

    // 4. Fix convert artifacts
    for (const item of this.CONVERT_ARTIFACTS) {
      cleaned = cleaned.replace(item.pattern, item.replace);
    }

    // 5. Replace glossary terms if any Chinese keyword was left
    for (const term of terms) {
      if (term.zh && term.vi && cleaned.includes(term.zh)) {
        cleaned = cleaned.replaceAll(term.zh, term.vi);
      }
    }

    // 6. Dialogue quotes & paragraph normalization
    cleaned = cleaned.replace(/^[ \t]*[\*\-][ \t]+(")/gm, '$1');
    cleaned = cleaned.replace(/^[ \t]*[\*\-][ \t]+([A-ZÀ-Ỹ])/gm, '$1');
    cleaned = cleaned.replace(/([.!?…"])\r?\n(")/g, '$1\n\n$2');
    cleaned = cleaned.replace(/(")\r?\n([A-ZÀ-Ỹ])/g, '$1\n\n$2');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 7. Auto-close quotation mark if unclosed
    const quotes = (cleaned.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      cleaned = cleaned.trim() + '"';
    }

    return cleaned.trim();
  }

  /**
   * Backward compatible process method
   */
  static process(text, terms = [], rawText = '', context = {}) {
    const autoFixed = this.autoFix(text, terms);
    const qaReport = this.audit(autoFixed, rawText, { ...context, terms });

    return {
      text: autoFixed,
      issues: qaReport.issues.map(i => i.message),
      chineseCharCount: qaReport.stats.chineseCharCount,
      qaReport
    };
  }
}

module.exports = PostProcessor;
