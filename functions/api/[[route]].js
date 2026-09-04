// Cloudflare Pages Function: Fullstack API handler with Cloudflare D1 Database
// Provides high-performance Edge routing for DichTruyenPro / EDITHANGLOAT

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function errorJson(message, status = 500) {
  return json({ error: message, message }, status);
}

// Unicode-aware word boundary for Vietnamese (diacritics support)
const WORD_CHAR = "A-Za-z0-9_\\u00C0-\\u1EFF";

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordRegex(term) {
  const escaped = escapeRegex(term);
  return new RegExp(`(?<![${WORD_CHAR}])(?:${escaped})(?![${WORD_CHAR}])`, "gu");
}

// Strips the modern-Vietnamese polite sentence-final particle "ạ" in ancient novels
function stripPoliteA(text) {
  if (!text) return text;
  const notGluedToWord = `(?<![${WORD_CHAR}])`;
  return text
    .replace(new RegExp(`[ \\t]*${notGluedToWord}ạ(?=[.!?,;:…"'”])`, "gu"), "")
    .replace(new RegExp(`[ \\t]*${notGluedToWord}ạ$`, "gmu"), "");
}

// Apply a list of {find, replace} rules to text with Unicode-aware wholeWord support
function applyReplacements(text, rules, wholeWord = false) {
  let result = text || "";
  let count = 0;
  for (const { find, replace } of (rules || [])) {
    if (!find) continue;
    if (wholeWord) {
      const re = wholeWordRegex(find);
      const matches = result.match(re);
      if (matches) {
        count += matches.length;
        result = result.replace(re, replace || "");
      }
    } else {
      const parts = result.split(find);
      count += parts.length - 1;
      result = parts.join(replace || "");
    }
  }
  return { text: result, count };
}

// Scan preview matches without modifying text
function previewReplacements(text, rules, wholeWord = false) {
  let count = 0;
  const samples = [];
  for (const { find } of (rules || [])) {
    if (!find) continue;
    if (wholeWord) {
      const re = wholeWordRegex(find);
      const matches = [...text.matchAll(re)];
      count += matches.length;
      matches.slice(0, 3).forEach(m => {
        const start = Math.max(0, m.index - 30);
        const end = Math.min(text.length, m.index + m[0].length + 30);
        samples.push(text.slice(start, end).trim());
      });
    } else {
      let from = 0;
      while (from < text.length) {
        const idx = text.indexOf(find, from);
        if (idx === -1) break;
        count++;
        if (samples.length < 3) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(text.length, idx + find.length + 30);
          samples.push(text.slice(start, end).trim());
        }
        from = idx + find.length;
      }
    }
  }
  return { count, samples };
}

// Extract pronoun pairs and detected characters from chapter text
function extractPronounAudit(text, characters = [], pronounMatrix = []) {
  if (!text) return { charactersDetected: [], pronounPairs: [] };

  const detectedChars = [];
  for (const c of (characters || [])) {
    const name = c.vi || c.zh;
    if (!name || name.length < 2) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = text.match(new RegExp(`\\b${escaped}\\b`, 'gi'));
    if (matches && matches.length > 0) {
      detectedChars.push({ name, count: matches.length, gender: c.gender || 'Chưa rõ', role: c.role || '' });
    }
  }

  const pairs = [];
  const addedKeys = new Set();

  // 1. Evaluate predefined pronoun matrix
  for (const p of (pronounMatrix || [])) {
    const sName = p.speakerVi || p.speakerZh;
    const lName = p.listenerVi || p.listenerZh;
    if (!sName || !lName) continue;

    const hasSpeaker = text.includes(sName);
    const hasSelf = p.speakerCallsSelf ? text.includes(p.speakerCallsSelf) : false;
    const hasListener = p.speakerCallsListener ? text.includes(p.speakerCallsListener) : false;

    if (hasSpeaker && (hasSelf || hasListener)) {
      const key = `${sName}➔${lName}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        pairs.push({
          speaker: sName,
          listener: lName,
          speakerSelf: p.speakerCallsSelf || 'ta',
          speakerCallsOther: p.speakerCallsListener || 'ngươi',
          status: 'consistent'
        });
      }
    }
  }

  // 2. Scan quotes for dialogues
  const quotes = text.match(/[“"][^”"\n]{3,150}[”"]/g) || [];
  for (const q of quotes) {
    if (/(?:Hoàng thượng|Bệ hạ)/i.test(q)) {
      if (/\bthảo dân\b/i.test(q)) {
        const key = `Thảo dân / Ôn Trì➔Hoàng thượng`;
        if (!addedKeys.has(key)) {
          addedKeys.add(key);
          pairs.push({
            speaker: 'Thảo dân / Ôn Trì',
            listener: 'Hoàng thượng',
            speakerSelf: 'thảo dân',
            speakerCallsOther: 'Hoàng thượng',
            status: 'consistent'
          });
        }
      } else if (/\btôi\b/i.test(q)) {
        const key = `Bề dưới➔Hoàng thượng`;
        if (!addedKeys.has(key)) {
          addedKeys.add(key);
          pairs.push({
            speaker: 'Bề dưới',
            listener: 'Hoàng thượng',
            speakerSelf: 'tôi',
            speakerCallsOther: 'Hoàng thượng',
            status: 'inconsistent'
          });
        }
      }
    }

    if (/(?:Nương nương|Hoàng hậu)/i.test(q)) {
      if (/\bthảo dân\b/i.test(q) || /\bdân nữ\b/i.test(q)) {
        const key = `Ôn Trì➔Đỗ Chiêu Ly (Nương nương)`;
        if (!addedKeys.has(key)) {
          addedKeys.add(key);
          pairs.push({
            speaker: 'Ôn Trì',
            listener: 'Đỗ Chiêu Ly (Nương nương)',
            speakerSelf: /\bdân nữ\b/i.test(q) ? 'dân nữ' : 'thảo dân',
            speakerCallsOther: 'nương nương',
            status: 'consistent'
          });
        }
      }
    }

    if (/\bbản cung\b/i.test(q)) {
      const key = `Đỗ Chiêu Ly (Hoàng hậu)➔Bề dưới`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        pairs.push({
          speaker: 'Đỗ Chiêu Ly (Hoàng hậu)',
          listener: 'Bề dưới / Cung nhân',
          speakerSelf: 'bản cung',
          speakerCallsOther: 'ngươi',
          status: 'consistent'
        });
      }
    }

    if (/\btrẫm\b/i.test(q)) {
      const key = `Hoàng đế➔Quần thần`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        pairs.push({
          speaker: 'Hoàng đế',
          listener: 'Quần thần / Hậu cung',
          speakerSelf: 'trẫm',
          speakerCallsOther: 'khanh / các ngươi',
          status: 'consistent'
        });
      }
    }
  }

  return {
    charactersDetected: detectedChars,
    pronounPairs: pairs
  };
}

// 7-Pillar QA Audit Engine (matching PostProcessor.audit)
function auditText(text, originalText = '', glossary = {}) {
  const issues = [];
  const chars = glossary.characters || [];
  const terms = glossary.terms || [];
  const pronounMatrix = glossary.pronounMatrix || [];

  if (!text || !text.trim()) {
    return {
      status: 'critical',
      summary: 'Bản dịch trống!',
      issues: [{ id: 'empty', type: 'omission', severity: 'critical', title: 'Nội dung trống', message: 'Không có bản dịch.' }],
      stats: { totalIssues: 1, criticalCount: 1, warningCount: 0, chineseCharCount: 0 }
    };
  }

  // 1. Untranslated Chinese characters
  const hanChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const hanGroups = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  if (hanGroups.length > 0) {
    const samples = [...new Set(hanGroups)].slice(0, 5);
    issues.push({
      id: 'han_err',
      type: 'untranslated_chinese',
      severity: 'critical',
      title: 'Dính chữ Hán chưa dịch',
      message: `Còn sót ${hanGroups.length} cụm chữ Hán trong bản dịch (Ví dụ: ${samples.join(', ')}).`,
      targetSnippet: samples[0],
      instruction: `Dịch hoàn chỉnh chữ Hán "${samples[0]}" sang tiếng Việt theo ngữ cảnh.`
    });
  }

  // 2. Untranslated / convert artifacts
  const convertArtifacts = [
    { regex: /\b(của hắn|của nàng|của bọn họ) đích\b/gi, title: 'Dính chữ "đích"', sample: 'đích', rep: '' },
    { regex: /\b(vạn phần|thập phần|vô bỉ|cực độ)\b/gi, title: 'Hán Việt sượng sùng', sample: 'vạn phần', rep: 'vô cùng' },
    { regex: /\b(nhịn không được|không kìm lòng được)\b/gi, title: 'Cụm từ máy móc', sample: 'nhịn không được', rep: 'không nén nổi / không kìm được' }
  ];
  for (const art of convertArtifacts) {
    const match = text.match(art.regex);
    if (match) {
      issues.push({
        id: `art_${art.sample}`,
        type: 'convert_artifacts',
        severity: 'info',
        title: art.title,
        message: `Phát hiện cụm convert thô "${match[0]}".`,
        targetSnippet: match[0],
        instruction: `Thay "${match[0]}" bằng từ ngữ tiếng Việt tự nhiên và mượt mà hơn.`
      });
      break;
    }
  }

  // 3. Length Truncation
  const origLen = (originalText || '').trim().length;
  const transLen = text.trim().length;
  if (origLen > 200 && transLen < origLen * 0.35) {
    issues.push({
      id: 'trunc_err',
      type: 'omission',
      severity: 'warning',
      title: 'Độ dài ngắn bất thường',
      message: `Bản dịch chỉ có ${transLen} ký tự so với ${origLen} gốc (nghi ngờ bị tóm tắt hoặc rớt câu).`,
      actionType: 'proofread'
    });
  }

  // 4. Loop Hallucination
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  const lineCounts = {};
  for (const l of lines) {
    lineCounts[l] = (lineCounts[l] || 0) + 1;
    if (lineCounts[l] >= 3) {
      issues.push({
        id: 'loop_err',
        type: 'loop_hallucination',
        severity: 'critical',
        title: 'Lặp đoạn AI (Ảo giác)',
        message: `Đoạn sau bị lặp lại ${lineCounts[l]} lần: "${l.slice(0, 40)}..."`,
        targetSnippet: l,
        instruction: 'Xóa bớt các đoạn bị lặp trùng lặp và giữ lại 1 đoạn duy nhất.'
      });
      break;
    }
  }

  // 5. Quotation balance
  const openDouble = (text.match(/“/g) || []).length;
  const closeDouble = (text.match(/”/g) || []).length;
  if (openDouble !== closeDouble) {
    issues.push({
      id: 'quote_err',
      type: 'quotation_balance',
      severity: 'warning',
      title: 'Lệch dấu ngoặc kép',
      message: `Số dấu mở “ (${openDouble}) lệch với số dấu đóng ” (${closeDouble}).`,
      actionType: 'auto_fix'
    });
  }

  // 6. Dialogue pronoun check (detect modern pronouns in royal/historical context)
  const quotes = text.match(/[“"][^”"\n]{3,150}[”"]/g) || [];
  const pronounViolations = [];
  for (const q of quotes) {
    if (/(?:Hoàng thượng|Bệ hạ|nương nương|Hoàng hậu)/i.test(q) && /\btôi\b/i.test(q)) {
      pronounViolations.push(q);
    }
  }
  if (pronounViolations.length > 0) {
    issues.push({
      id: 'pronoun_modern',
      type: 'pronoun_inconsistency',
      severity: 'warning',
      title: 'Lẫn đại từ hiện đại "tôi" trong thoại cung đình',
      message: `Phát hiện ${pronounViolations.length} câu thoại xưng "tôi" trước mặt Hoàng đế / Hoàng hậu.`,
      targetSnippet: pronounViolations[0],
      instruction: 'Đổi "tôi" thành "thảo dân", "dân nữ" hoặc xưng hô phù hợp với phẩm hàm.'
    });
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  let overallStatus = 'clean';
  if (criticalCount > 0) overallStatus = 'critical';
  else if (warningCount > 0) overallStatus = 'warning';

  const pronounAudit = extractPronounAudit(text, chars, pronounMatrix);

  return {
    status: overallStatus,
    summary: criticalCount > 0 ? `Phát hiện ${criticalCount} lỗi nghiêm trọng!` : warningCount > 0 ? `Có ${warningCount} cảnh báo cần lưu ý.` : 'Bản dịch đạt chuẩn xuất bản!',
    issues,
    pronounAudit,
    stats: {
      totalIssues: issues.length,
      criticalCount,
      warningCount,
      chineseCharCount: hanChars.length
    }
  };
}

// Comprehensive Sino-Vietnamese (Hán Việt) phonetic lookup map
// Covers characters commonly found in Chinese web novels to eradicate 100% leftover Hanzi
const SINO_VIET_MAP = {
  '兰': 'lan', '萬': 'vạn', '万': 'vạn', '思': 'tư', '忠': 'trung', '署': 'thự', '上': 'thượng', '娘': 'nương',
  '竹': 'trúc', '殿': 'điện', '笑': 'tiếu', '終': 'chung', '偏': 'thiên', '嬌': 'kiều', '宴': 'yến', '竟': 'cánh',
  '璃': 'ly', '乐': 'lạc', '樂': 'lạc', '药': 'dược', '藥': 'dược', '院': 'viện', '判': 'phán', '使': 'sứ',
  '医': 'y', '醫': 'y', '生': 'sinh', '帝': 'đế', '后': 'hậu', '妃': 'phi', '王': 'vương', '公': 'công',
  '主': 'chúa', '爷': 'gia', '爺': 'gia', '哥': 'ca', '姐': 'tỷ', '妹': 'muội', '弟': 'đệ', '儿': 'nhi',
  '兒': 'nhi', '女': 'nữ', '子': 'tử', '君': 'quân', '臣': 'thần', '侯': 'hầu', '卿': 'khanh', '官': 'quan',
  '府': 'phủ', '堂': 'đường', '阁': 'các', '閣': 'các', '宫': 'cung', '宮': 'cung', '寺': 'tự', '城': 'thành',
  '国': 'quốc', '國': 'quốc', '朝': 'triều', '代': 'đại', '宗': 'tông', '门': 'môn', '門': 'môn', '派': 'phái',
  '道': 'đạo', '法': 'pháp', '剑': 'kiếm', '劍': 'kiếm', '刀': 'đao', '枪': 'thương', '槍': 'thương', '拳': 'quyền',
  '掌': 'chưởng', '心': 'tâm', '神': 'thần', '魔': 'ma', '妖': 'yêu', '鬼': 'quỷ', '仙': 'tiên', '佛': 'phật',
  '龙': 'long', '龍': 'long', '凤': 'phượng', '鳳': 'phượng', '虎': 'hổ', '玄': 'huyền', '武': 'vũ', '天': 'thiên',
  '地': 'địa', '人': 'nhân', '山': 'sơn', '海': 'hải', '江': 'giang', '河': 'hà', '风': 'phong', '風': 'phong',
  '云': 'vân', '雲': 'vân', '雨': 'vũ', '雪': 'tuyết', '月': 'nguyệt', '日': 'nhật', '星': 'tinh', '光': 'quang',
  '暗': 'ám', '明': 'minh', '清': 'thanh', '白': 'bạch', '黑': 'hắc', '红': 'hồng', '紅': 'hồng', '黄': 'hoàng',
  '黃': 'hoàng', '青': 'thanh', '紫': 'tử', '金': 'kim', '银': 'ngân', '銀': 'ngân', '玉': 'ngọc', '珠': 'châu',
  '宝': 'bảo', '寶': 'bảo', '石': 'thạch', '火': 'hỏa', '水': 'thủy', '木': 'mộc', '土': 'thổ',
  '太': 'thái', '皇': 'hoàng', '大': 'đại', '小': 'tiểu', '老': 'lão', '少': 'thiếu', '中': 'trung',
  '前': 'tiền', '左': 'tả', '右': 'hữu', '东': 'đông', '西': 'tây', '南': 'nam', '北': 'bắc',
  '春': 'xuân', '夏': 'hạ', '秋': 'thu', '冬': 'đông', '夜': 'dạ', '晨': 'thần', '夕': 'tịch', '暮': 'mộ',
  '花': 'hoa', '草': 'thảo', '树': 'thụ', '林': 'lâm', '叶': 'diệp', '葉': 'diệp', '枝': 'chi', '根': 'căn',
  '鸟': 'điểu', '獸': 'thú', '兽': 'thú', '鱼': 'ngư', '魚': 'ngư', '虫': 'trùng', '蟲': 'trùng',
  '父': 'phụ', '母': 'mẫu', '兄': 'huynh', '夫': 'phu', '妻': 'thê', '妾': 'thiếp', '奴': 'nô', '婢': 'tỳ',
  '侍': 'thị', '卫': 'vệ', '衛': 'vệ', '兵': 'binh', '将': 'tướng', '帥': 'soái', '帅': 'soái', '军': 'quân',
  '軍': 'quân', '师': 'sư', '師': 'sư', '徒': 'đồ', '友': 'hữu', '敌': 'địch', '仇': 'thù', '客': 'khách',
  '家': 'gia', '族': 'tộc', '名': 'danh', '字': 'tự', '号': 'hiệu', '號': 'hiệu',
  '死': 'tử', '伤': 'thương', '傷': 'thương', '病': 'bệnh', '残': 'tàn', '廢': 'phế', '废': 'phế',
  '善': 'thiện', '恶': 'ác', '惡': 'ác', '真': 'chân', '假': 'giả', '美': 'mỹ', '丑': 'sửu', '高': 'cao',
  '低': 'đê', '深': 'thâm', '浅': 'thiển', '重': 'trọng', '轻': 'khinh', '快': 'khoái', '慢': 'mạn',
  '难': 'nan', '易': 'dịch', '新': 'tân', '旧': 'cựu', '长': 'trường', '短': 'đoản', '远': 'viễn', '近': 'cận',
  '正': 'chính', '反': 'phản', '合': 'hợp', '分': 'phân', '同': 'đồng', '异': 'dị',
  '安': 'an', '危': 'nguy', '吉': 'cát', '凶': 'hung', '胜': 'thắng', '敗': 'bại', '败': 'bại',
  '成': 'thành', '毁': 'hủy', '得': 'đắc', '失': 'thất', '爱': 'ái', '愛': 'ái', '恨': 'hận', '情': 'tình',
  '义': 'nghĩa', '義': 'nghĩa', '理': 'lý', '气': 'khí', '氣': 'khí', '志': 'chí', '力': 'lực', '势': 'thế',
  '勢': 'thế', '威': 'uy', '权': 'quyền', '權': 'quyền', '位': 'vị', '德': 'đức', '恩': 'ân',
  '福': 'phúc', '寿': 'thọ', '壽': 'thọ', '禄': 'lộc', '祿': 'lộc', '喜': 'hỷ', '怒': 'nộ', '哀': 'ai',
  '悲': 'bi', '欢': 'hoan', '愁': 'sầu', '苦': 'khổ', '忧': 'ưu', '懼': 'cụ', '惧': 'cụ',
  '惊': 'kinh', '驚': 'kinh', '恐': 'khủng', '慌': 'hoảng', '乱': 'loạn', '亂': 'loạn', '静': 'tĩnh',
  '定': 'định', '平': 'bình', '和': 'hòa', '穆': 'mục', '泰': 'thái', '康': 'khang', '宁': 'ninh', '寧': 'ninh',
  '昭': 'chiêu', '宣': 'tuyên', '显': 'hiển', '隱': 'ẩn', '隐': 'ẩn', '秘': 'bí', '妙': 'diệu',
  '奇': 'kỳ', '怪': 'quái', '殊': 'thù', '绝': 'tuyệt', '頂': 'đỉnh', '顶': 'đỉnh', '极': 'cực',
  '至': 'chí', '最': 'tối', '初': 'sơ', '终': 'chung', '本': 'bản', '末': 'mạt', '原': 'nguyên', '因': 'nhân',
  '果': 'quả', '报': 'báo', '報': 'báo', '应': 'ứng', '應': 'ứng', '验': 'nghiệm', '驗': 'nghiệm',
  '迟': 'trì', '遲': 'trì', '温': 'ôn', '溫': 'ôn', '杜': 'đỗ', '魏': 'ngụy', '吴': 'ngô', '吳': 'ngô',
  '何': 'hà', '刘': 'lưu', '劉': 'lưu', '李': 'lý', '张': 'trương', '張': 'trương',
  '赵': 'triệu', '趙': 'triệu', '钱': 'tiền', '錢': 'tiền', '孙': 'tôn', '孫': 'tôn', '周': 'chu',
  '陈': 'trần', '陳': 'trần', '杨': 'dương', '楊': 'dương', '沈': 'thẩm', '苏': 'tô', '蘇': 'tô',
  '卢': 'lô', '盧': 'lô', '崔': 'thôi', '谢': 'tạ', '謝': 'tạ', '韩': 'hàn', '韓': 'hàn', '宋': 'tống',
  '唐': 'đường', '梁': 'lương', '齐': 'tề', '齊': 'tề', '楚': 'sở', '秦': 'tần', '燕': 'yến', '晋': 'tấn',
  '蜀': 'thục', '越': 'việt', '萧': 'tiêu', '蕭': 'tiêu', '方': 'phương',
  '霜': 'sương', '枫': 'phong', '荷': 'hà', '莲': 'liên', '菊': 'cúc', '梅': 'mai',
  '柳': 'liễu', '松': 'tùng', '柏': 'bách', '桂': 'quế', '槐': 'hòe', '梧': 'ngô', '桐': 'đồng',
  '荆': 'kinh', '棘': 'cức', '藤': 'đằng', '萝': 'la', '芝': 'chi', '苓': 'linh', '术': 'thuật',
  '参': 'sâm', '芪': 'kỳ', '归': 'quy', '歸': 'quy', '芎': 'khung', '芍': 'thược',
  '香': 'hương', '味': 'vị', '甘': 'cam', '辛': 'tân', '酸': 'toan', '咸': 'hàm',
  '寒': 'hàn', '热': 'nhiệt', '熱': 'nhiệt', '凉': 'lương', '涼': 'lương',
  '毒': 'độc', '解': 'giải', '补': 'bổ', '補': 'bổ', '泻': 'tả', '瀉': 'tả', '汗': 'hãn',
  '吐': 'thổ', '下': 'hạ', '治': 'trị', '救': 'cứu', '愈': 'dũ',
  '疾': 'tật', '痛': 'thống', '痒': 'ngứa', '麻': 'ma',
  '胀': 'trướng', '脹': 'trướng', '满': 'mãn', '滿': 'mãn', '闷': 'muộn', '悶': 'muộn', '烦': 'phiền',
  '燥': 'táo', '渴': 'khát', '饥': 'cơ', '飽': 'bão', '饱': 'bão', '困': 'khốn', '乏': 'phạp', '倦': 'quyện'
};

const COMMON_HANZI_PHRASES = {
  '娘娘': 'nương nương',
  'nương娘': 'nương nương',
  'Nương娘': 'Nương nương',
  '怎么': 'làm sao',
  '偏偏': 'ngặt nỗi',
  '御药署': 'Ngự dược thự',
  'Ngự药署': 'Ngự dược thự',
  'Ngự dược署': 'Ngự dược thự',
  'Thái y 院': 'Thái y viện',
  'Thái医院': 'Thái y viện',
  'y 院': 'y viện',
  'Thọ宴': 'Thọ yến',
  'cáo退': 'cáo lui',
  'Đỗ Chiêu璃': 'Đỗ Chiêu Ly',
  'Chiêu璃': 'Chiêu Ly',
  'Hoàng上': 'Hoàng Thượng',
  'A Trì': 'A Trì',
  '阿迟': 'A Trì',
  '温迟': 'Ôn Trì'
};

// Automatic Sino-Vietnamese Hanzi Sanitizer
function sanitizeLeftoverHanzi(text) {
  if (!text) return '';
  let res = text;

  // 1. Replace multi-character phrases first
  for (const [k, v] of Object.entries(COMMON_HANZI_PHRASES)) {
    res = res.split(k).join(v);
  }

  // 2. Handle half-translated names/compounds: "Tử兰" -> "Tử Lan", "Ngô万" -> "Ngô Vạn", "Hà思忠" -> "Hà Tư Trung", "An乐" -> "An Lạc"
  res = res.replace(/([A-ZÀ-Ỹa-zà-ỹ]+)([\u4e00-\u9fa5]+)/g, (match, p1, p2) => {
    const isCap = /^[A-ZÀ-Ỹ]/.test(p1);
    const converted = p2.split('').map(ch => {
      const vi = SINO_VIET_MAP[ch] || '';
      if (!vi) return ch;
      return isCap ? vi.charAt(0).toUpperCase() + vi.slice(1) : vi;
    }).join(' ');
    return `${p1} ${converted}`;
  });

  // Handle Hanzi directly before Latin: "阿Trì" -> "A Trì"
  res = res.replace(/([\u4e00-\u9fa5]+)([A-ZÀ-Ỹa-zà-ỹ]+)/g, (match, p1, p2) => {
    const isCap = /^[A-ZÀ-Ỹ]/.test(p2);
    const converted = p1.split('').map(ch => {
      const vi = SINO_VIET_MAP[ch] || '';
      if (!vi) return ch;
      return isCap ? vi.charAt(0).toUpperCase() + vi.slice(1) : vi;
    }).join(' ');
    return `${converted} ${p2}`;
  });

  // 3. Convert any standalone single Chinese characters
  res = res.replace(/[\u4e00-\u9fa5]/g, (ch) => {
    const vi = SINO_VIET_MAP[ch];
    return vi || ch;
  });

  return res;
}

// Automated Text Cleaner & 1-Click Auto-Fix helper
function autoFixContent(text, context = {}) {
  if (!text) return text;
  let fixed = text;

  // Clean meta AI chatter
  fixed = fixed.replace(/^.*?(?:đây là bản dịch|dưới đây là bản dịch|sau đây là bản dịch|bản dịch tiếng việt).*?:\s*\n+/gim, '');
  fixed = fixed.replace(/\n+.*?(?:hy vọng bản dịch làm bạn hài lòng|nếu cần chỉnh sửa gì thêm|chúc bạn đọc truyện vui vẻ).*$/gim, '');

  // Punctuation normalization (convert fullwidth Chinese punctuation to standard Vietnamese)
  fixed = fixed
    .replace(/，/g, ', ')
    .replace(/。/g, '. ')
    .replace(/！/g, '! ')
    .replace(/？/g, '? ')
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/（/g, ' (')
    .replace(/）/g, ') ')
    .replace(/【/g, ' [')
    .replace(/】/g, '] ')
    .replace(/《/g, ' "')
    .replace(/》/g, '" ')
    .replace(/——/g, ' — ')
    .replace(/…/g, '...');

  // Extract Vietnamese from mixed Han-Viet patterns: e.g. "阿迟 (A Trì)" -> "A Trì"
  fixed = fixed.replace(/[\u4e00-\u9fa5]+\s*\(([^)]+)\)/g, '$1');

  // Convert all leftover Chinese characters into Sino-Vietnamese
  fixed = sanitizeLeftoverHanzi(fixed);

  // Convert artifacts & smooth phrasing
  fixed = fixed.replace(/\bđích\b/g, '');
  fixed = fixed.replace(/\bcủa (hắn|nàng|ta|ngươi|họ) đích\b/gi, 'của $1');
  fixed = fixed.replace(/\bnhịn không được\b/gi, 'không kìm được');
  fixed = fixed.replace(/\bkhông kìm được mà\b/gi, 'không kìm được');
  fixed = fixed.replace(/\bôm ấp hy vọng\b/gi, 'nuôi hy vọng');
  fixed = fixed.replace(/\bhơi hơi\b/gi, 'hơi');
  fixed = fixed.replace(/\btrong lúc nhất thời\b/gi, 'nhất thời');
  fixed = fixed.replace(/\bthời điểm đó\b/gi, 'lúc đó');
  fixed = fixed.replace(/\bkhông khỏi thầm nghĩ\b/gi, 'thầm nghĩ');
  fixed = fixed.replace(/\bđối với việc này\b/gi, 'về việc này');
  fixed = fixed.replace(/\btheo vách đá\b/gi, 'lao dốc');
  fixed = fixed.replace(/\btruyền thông tự nhân\b/gi, 'truyền thông độc lập');

  // Dialogue pronoun fixing in royal/palace context:
  // 1. Foreign envoys / emissaries addressing Empress Dowager / Emperor
  fixed = fixed.replace(/Nước chúng tôi/g, 'Nước chúng thần');

  // 2. Eradicate modern "tôi" in ANY dialogue addressing or mentioning royalty (Hoàng thượng, Bệ hạ, Nương nương, Hoàng hậu, Thái hậu)
  fixed = fixed.replace(/(“[^”\n]*?”|"[^"\n]*?")/g, (dialogue) => {
    if (/(?:Hoàng thượng|Bệ hạ|Nương nương|Hoàng hậu|Thái hậu)/i.test(dialogue)) {
      return dialogue
        .replace(/\bTôi tôi tôi,\s*tự mình bôi\b/gi, 'Thảo dân, thảo dân tự mình bôi')
        .replace(/\bTôi\b/g, 'Thảo dân')
        .replace(/\btôi\b/g, 'thảo dân')
        .replace(/\bta phụng mệnh\b/gi, 'thảo dân phụng mệnh');
    }
    return dialogue;
  });

  // 3. Common specific fixes
  fixed = fixed.replace(/của tôi ấy mà/g, 'của thảo dân ấy mà');
  fixed = fixed.replace(/đại nhân của tôi/g, 'đại nhân của ta');

  // 4. Strip modern polite "ạ" in ancient context
  fixed = stripPoliteA(fixed);

  // Balance unpaired quotes
  const opens = (fixed.match(/“/g) || []).length;
  const closes = (fixed.match(/”/g) || []).length;
  if (opens > closes) {
    fixed += '”'.repeat(opens - closes);
  }

  // Clean double spaces and spaces before punctuation
  fixed = fixed.replace(/[^\S\r\n]{2,}/g, ' ');
  fixed = fixed.replace(/[^\S\r\n]+([,.\?!;:])/g, '$1');

  // Standardize novel paragraph spacing: ensure every paragraph & dialogue has exactly 1 empty line break (\n\n)
  const lines = fixed.split('\n').map(l => l.trim()).filter(Boolean);
  fixed = lines.join('\n\n');

  return fixed.trim();
}


// Native Edge DOCX & EPUB Text Extractors using Web Standard DecompressionStream
async function extractDocxText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  while (offset <= bytes.length - 30) {
    if (view.getUint32(offset, true) === 0x04034b50) {
      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const fileNameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + fileNameLen));
      const dataStart = offset + 30 + fileNameLen + extraLen;

      if (name === 'word/document.xml') {
        const compressed = bytes.subarray(dataStart, dataStart + compSize);
        let xml = '';
        if (compMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Response(compressed).body.pipeThrough(ds);
          xml = await new Response(stream).text();
        } else {
          xml = new TextDecoder().decode(compressed);
        }

        return xml
          .replace(/<\/w:p>/gi, '\n\n')
          .replace(/<w:br[^>]*\/>/gi, '\n')
          .replace(/<w:tab[^>]*\/>/gi, '\t')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
      }
      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }
  throw new Error('Không tìm thấy nội dung văn bản trong file .docx');
}

async function extractEpubText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  let offset = 0;
  let fullText = '';

  while (offset <= bytes.length - 30) {
    if (view.getUint32(offset, true) === 0x04034b50) {
      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const fileNameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + fileNameLen)).toLowerCase();
      const dataStart = offset + 30 + fileNameLen + extraLen;

      if ((name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')) &&
          !name.includes('nav.') && !name.includes('toc.') && !name.includes('cover.')) {
        const compressed = bytes.subarray(dataStart, dataStart + compSize);
        let html = '';
        if (compMethod === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Response(compressed).body.pipeThrough(ds);
          html = await new Response(stream).text();
        } else {
          html = new TextDecoder().decode(compressed);
        }

        const chapterText = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();

        if (chapterText) {
          fullText += '\n\n' + chapterText;
        }
      }
      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }
  return fullText.trim();
}

function normalizeModel(model) {
  if (!model) return 'gemini-3.6-flash';
  const m = model.trim().toLowerCase();
  if (m.includes('lite') || m.includes('3.1')) {
    return 'gemini-3.1-flash-lite';
  }
  return 'gemini-3.6-flash';
}

function splitTextIntoChapters(rawText, { singleChapter = false, customPattern = '', fallbackTitle = 'Chương 1' } = {}) {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\uFEFF/g, '');

  if (singleChapter) {
    const lines = text.trim().split('\n');
    const firstLine = lines[0].trim().replace(/^[\u3000\s]+/, '');
    const isShortTitle = firstLine.length <= 80 && !firstLine.includes('，') && !firstLine.includes('。');
    return [{
      title: isShortTitle ? firstLine : fallbackTitle,
      content: (isShortTitle ? lines.slice(1).join('\n') : text).trim()
    }];
  }

  const runRegex = (reg) => {
    const list = [];
    let m;
    while ((m = reg.exec(text)) !== null) {
      list.push({
        title: m[1].trim(),
        startIndex: m.index + (m[0].startsWith('\n') ? 1 : 0),
        headerLength: m[0].length
      });
    }
    return list;
  };

  let matches = [];

  if (customPattern && customPattern.trim()) {
    const pat = customPattern.trim();
    let reg;
    if (pat.includes('*')) {
      const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[0-9一二三四五六七八九十百千万零两０-９\\s]+');
      reg = new RegExp(`(?:^|\\n)[\\s\\u3000]*(${escaped}[^\\n]*)`, 'gi');
    } else {
      const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      reg = new RegExp(`(?:^|\\n)[\\s\\u3000]*(${escaped}[^\\n]*)`, 'gi');
    }
    matches = runRegex(reg);
  } else {
    // Ultra-comprehensive auto pattern:
    // 1) Jinjiang & novel symbols: ☆、, ★、, ◇、, ◆、, ○、, 【, (, （, [, 〔, 《
    // 2) Chinese keywords: 第...章, 第...回, 第...节, 第...卷, 第...集, 第...部, 第...话, 第...篇, 第...折, 第...幕, 第...更
    // 3) Vietnamese/English keywords: Chương, Hồi, Tiết, Quyển, Tập, Chapter, Chap, Episode, Part
    // 4) Special sections: 番外 (Ngoại truyện), 尾声, 大结局, 后记, 楔子, 序章, 终章
    // 5) Numbering lines: 1. , 1、, 001 , 1: , 1 - , 1/179
    // 6) Delimiters: ===, ---, ***, ###
    const primaryRegex = /(?:^|\n)[\s\u3000]*([☆★◇◆○●【〔\[(（]?\s*[、.·\s]*\s*(?:第\s*[0-9一二三四五六七八九十百千万零两０-９]+\s*[章回节卷集部话篇折幕更]|(?:Chương|Hồi|Tiết|Quyển|Tập|Chapter|Chap|Episode|Part)\s*[0-9一二三四五六七八九十百千万零两０-９]+|={3,}[^=\n]+={3,}|-{3,}[^-\n]+-{3,}|\*{3,}[^*\n]+\*{3,}|(?:番外|尾声|大结局|后记|楔子|序章|终章)[0-9一二三四五六七八九十百千万零两０-９\s]*|(?:(?:\(|\[|【|（)?[0-9０-９]{1,5}(?:\)|\]|】|）|\.|\、|：|:|-|—|\/|\s)\s*[^，。\n]{1,60}))[^\n]*)/gi;
    matches = runRegex(primaryRegex);

    // Smart Multi-Pass Fallback: If primary regex matched <= 2 chapters on a large file (> 15KB)
    if (matches.length <= 2 && text.length > 15000) {
      // Pass 1: Jinjiang prefix symbol format (e.g. ☆、第1章, ☆、1, 1、)
      const jinjiangRegex = /(?:^|\n)[\s\u3000]*([☆★◇◆○●]?\s*[0-9０-９一二三四五六七八九十百千万零两]+\s*[、.:：\-—/\s][^\n]{1,80})/gi;
      const pass1 = runRegex(jinjiangRegex);
      if (pass1.length > matches.length) matches = pass1;

      // Pass 2: Leading 1-4 digit numbers followed by space and title (e.g. 001 揭榜, 1 揭榜)
      if (matches.length <= 2) {
        const numTitleRegex = /(?:^|\n)[\s\u3000]*([0-9０-９]{1,4}\s+[^\n，。\s]{1,60}[^\n]*)/gi;
        const pass2 = runRegex(numTitleRegex);
        if (pass2.length > matches.length) matches = pass2;
      }

      // Pass 3: Chinese characters numbers (e.g. 一、, 二、, 第一、)
      if (matches.length <= 2) {
        const zhNumRegex = /(?:^|\n)[\s\u3000]*([一二三四五六七八九十百千万零两]+[、.:：\s][^\n]{1,60})/gi;
        const pass3 = runRegex(zhNumRegex);
        if (pass3.length > matches.length) matches = pass3;
      }

      // Pass 4: Pure bracketed numbering (e.g. 【1】, (1), [1])
      if (matches.length <= 2) {
        const bracketRegex = /(?:^|\n)[\s\u3000]*([【〔\[(（][0-9０-９一二三四五六七八九十百千万零两\s]+[】〕\])）][^\n]{0,60})/gi;
        const pass4 = runRegex(bracketRegex);
        if (pass4.length > matches.length) matches = pass4;
      }
    }
  }

  if (matches.length === 0) {
    const lines = text.trim().split('\n');
    const firstLine = lines[0].trim().replace(/^[\u3000\s]+/, '');
    const isShortTitle = firstLine.length <= 80 && !firstLine.includes('，') && !firstLine.includes('。');
    return [{
      title: isShortTitle ? firstLine : fallbackTitle,
      content: (isShortTitle ? lines.slice(1).join('\n') : text).trim()
    }];
  }

  const chapters = [];

  // Check if there is intro / prologue text before chapter 1
  if (matches[0].startIndex > 60) {
    const introText = text.slice(0, matches[0].startIndex).trim();
    if (introText.length > 30) {
      chapters.push({
        title: 'Mở đầu / Giới thiệu',
        content: introText
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nxt = matches[i + 1];
    const bodyStart = cur.startIndex;
    const bodyEnd = nxt ? nxt.startIndex : text.length;
    const rawChunk = text.slice(bodyStart, bodyEnd).trim();

    const lines = rawChunk.split('\n');
    const titleLine = lines[0].trim().replace(/^[\u3000\s]+/, '');
    const bodyText = lines.slice(1).join('\n').trim();

    chapters.push({
      title: titleLine || cur.title,
      content: bodyText || rawChunk
    });
  }

  return chapters;
}

// Helper: Ensure D1 database schema
async function initDb(db) {
  if (!db) return;
  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          genre TEXT,
          toneGuidance TEXT,
          model TEXT DEFAULT 'gemini-3.6-flash',
          characters TEXT DEFAULT '[]',
          terms TEXT DEFAULT '[]',
          pronounMatrix TEXT DEFAULT '[]',
          settings TEXT DEFAULT '{}',
          createdAt TEXT,
          updatedAt TEXT
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS chapters (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          title TEXT,
          chapterIndex INTEGER DEFAULT 0,
          originalText TEXT,
          translatedTitle TEXT,
          translatedText TEXT,
          status TEXT DEFAULT 'pending',
          summary TEXT,
          qaReport TEXT DEFAULT '{}',
          issues TEXT DEFAULT '[]',
          chineseCharCount INTEGER DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
        )
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(projectId, chapterIndex)`),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `)
    ]);
  } catch (e) {
    console.error('Error initDb:', e);
  }
}

// Helper: Read API Keys
async function getApiKeys(db, env) {
  let keys = [];
  if (db) {
    try {
      const row = await db.prepare("SELECT value FROM config WHERE key = 'apiKeys'").first();
      if (row && row.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) {
          keys = parsed;
        } else if (parsed && Array.isArray(parsed.apiKeys)) {
          keys = parsed.apiKeys;
        } else if (typeof parsed === 'string') {
          keys = [parsed];
        }
      }
    } catch (e) {}
  }
  if ((!keys || keys.length === 0) && env && env.GEMINI_API_KEY) {
    keys = env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
  }
  return Array.isArray(keys) ? keys : [];
}

// Universal safety settings for novel / literature translation
const GEMINI_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

// Helper: Call Gemini with Auto-rotation and Safety Handling
async function callGemini(keys, model, prompt, systemInstruction = '') {
  if (!keys || keys.length === 0) {
    throw new Error('Chưa có Gemini API Key nào được cài đặt. Hãy vào "Quản lý API Key" để thêm key.');
  }

  const targetModel = normalizeModel(model);
  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const rawK = keys[i];
    const keyStr = typeof rawK === 'object' ? rawK.key : rawK;

    const executeAttempt = async (targetModelName, userPrompt, sysInstr) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModelName}:generateContent?key=${keyStr}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.95
        },
        safetySettings: GEMINI_SAFETY_SETTINGS
      };

      if (sysInstr) {
        payload.systemInstruction = {
          parts: [{ text: sysInstr }]
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error?.message || res.statusText;
        if (res.status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota')) {
          return { errorType: 'QUOTA', errMsg };
        }
        return { errorType: 'OTHER', errMsg };
      }

      const blockReason = data.promptFeedback?.blockReason;
      const candidate = data.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (blockReason || finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
        return { errorType: 'SAFETY_BLOCKED', blockReason: blockReason || finishReason };
      }

      const parts = candidate?.content?.parts || [];
      const textParts = parts
        .filter(p => p && typeof p.text === 'string' && !p.thought)
        .map(p => p.text);

      if (!textParts.length && parts[0]?.text) {
        textParts.push(parts[0].text);
      }

      const fullText = textParts.join('').trim();
      if (!fullText) {
        return { errorType: 'EMPTY', blockReason: finishReason || 'EMPTY_PARTS' };
      }

      return { success: true, text: fullText };
    };

    try {
      let result = await executeAttempt(targetModel, prompt, systemInstruction);

      if (result.errorType === 'QUOTA') {
        console.warn(`Key ...${keyStr.slice(-4)} exhausted. Rotating next key...`);
        lastError = new Error(`Key ...${keyStr.slice(-4)} hết hạn mức (429).`);
        continue;
      }

      // If blocked by Google safety or returned empty, auto-retry with explicit literary fiction context
      if (result.errorType === 'SAFETY_BLOCKED' || result.errorType === 'EMPTY') {
        console.warn(`Prompt blocked (${result.blockReason}). Retrying with explicit literary fiction context...`);
        const reframedPrompt = `[BỐI CẢNH TÁC PHẨM VĂN HỌC NGHỆ THUẬT HƯ CẤU - TIỂU THUYẾT NGHỆ THUẬT / Y THUẬT / LỊCH SỬ]\nĐây là trích đoạn tác phẩm văn học nghệ thuật hư cấu thuần túy. Hãy dịch trung thực và chính xác toàn bộ sang tiếng Việt:\n\n${prompt}`;
        const reframedSys = `Bạn là dịch giả văn học nghệ thuật dịch tác phẩm tiểu thuyết hư cấu từ tiếng Trung sang tiếng Việt. Giữ nguyên 100% nội dung nghệ thuật của tác giả.\n${systemInstruction || ''}`;

        // Retry with current model
        let retryResult = await executeAttempt(targetModel, reframedPrompt, reframedSys);
        if (retryResult.success) {
          return retryResult.text;
        }

        // If still blocked, fallback to gemini-3.5-flash-lite or gemini-3.6-flash
        const fallbackModel = targetModel === 'gemini-3.5-flash-lite' ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite';
        const retryResult2 = await executeAttempt(fallbackModel, reframedPrompt, reframedSys);
        if (retryResult2.success) {
          return retryResult2.text;
        }

        throw new Error(`Gemini tạm thời từ chối do bộ lọc an toàn từ ngữ bản gốc (${retryResult.blockReason || result.blockReason}).`);
      }

      if (result.errorType === 'OTHER') {
        throw new Error(result.errMsg);
      }

      return result.text;
    } catch (err) {
      lastError = err;
      if (err.message && (err.message.includes('429') || err.message.includes('Quota'))) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Tất cả API keys đều bị lỗi hoặc hết hạn mức.');
}

// Helper: Auto-extract characters, dialogue pronoun matrix, and terms
async function autoExtractEntities(keys, model, text, genre) {
  if (!text || !text.trim()) return { characters: [], pronounMatrix: [], terms: [] };
  const prompt = `Bạn là chuyên gia phân tích văn bản tiểu thuyết Trung Quốc và biên tập dịch thuật tiếng Việt hàng đầu.
Nhiệm vụ: Hãy phân tích đoạn văn bản tiểu thuyết sau (thể loại: ${genre || 'Tiên Hiệp / Huyền Huyễn'}), trích xuất toàn bộ:
1. Danh sách Nhân vật:
   - zh: Tên tiếng Trung
   - vi: Tên Hán Việt chuẩn 100% bằng TIẾNG VIỆT CHỮ QUỐC NGỮ CÓ DẤU. TUYỆT ĐỐI KHÔNG ĐỂ LẠI KÝ TỰ CHỮ HÁN NÀO (Ví dụ: 杜昭璃 -> Đỗ Chiêu Ly, không được để là Đỗ Chiêu璃; 孙副总 -> Tôn phó tổng; 肖云 -> Tiêu Vân).
   - gender: Giới tính ("Nam" hoặc "Nữ")
   - narrativePronoun: Ngôi xưng dẫn chuyện chuẩn giới tính: Nữ dùng "nàng" hoặc "cô" (tuyệt đối không dùng "hắn" cho nữ); Nam dùng "hắn" hoặc "anh".
   - role: Thân phận / Vai vế (nhân vật chính, sư phụ, hoàng hậu, đạo diễn, v.v.)
   - notes: Ghi chú quan hệ
2. Ma trận Xưng hô: Giữa các cặp nhân vật tương tác / đối thoại trực tiếp:
   - speakerZh: Tên Trung người nói
   - listenerZh: Tên Trung người nghe
   - speakerCallsSelf: Người nói tự xưng là gì 100% bằng TIẾNG VIỆT (ta, em, tôi, thảo dân, tiểu bối, bản cung, trẫm...). TUYỆT ĐỐI KHÔNG DÙNG CHỮ HÁN NHƯ 我, 本座, 本宫.
   - speakerCallsListener: Người nói gọi người nghe là gì 100% bằng TIẾNG VIỆT (ngươi, nàng, cô, sư tôn, nương nương, bệ hạ, tổng tài, đạo diễn...). TUYỆT ĐỐI KHÔNG DÙNG CHỮ HÁN NHƯ 你, 娘娘, 导演.
   - notes: Thái độ (tôn kính, thân mật, thù địch...)
3. Thuật ngữ quan trọng: Tông môn, cảnh giới, địa danh, pháp bảo, cơ quan, chức vụ.

Văn bản mẫu:
"""
${text.slice(0, 8000)}
"""

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm Markdown code block \`\`\`json hoặc bất kỳ lời dẫn nào):
{
  "characters": [
    { "zh": "tên Trung", "vi": "Tên Hán Việt", "gender": "Nữ", "narrativePronoun": "nàng", "role": "nhân vật chính", "notes": "" }
  ],
  "pronounMatrix": [
    { "speakerZh": "tên người nói", "listenerZh": "tên người nghe", "speakerCallsSelf": "ta", "speakerCallsListener": "ngươi", "notes": "" }
  ],
  "terms": [
    { "zh": "từ Trung", "vi": "Dịch Hán Việt", "category": "Thuật ngữ" }
  ]
}`;

  try {
    const raw = await callGemini(keys, model, prompt);
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

    const cleanStr = (str) => {
      if (!str || typeof str !== 'string') return '';
      let s = str.replace(/[\u4e00-\u9fa5]+\s*\(([^)]+)\)/g, '$1');
      s = s.replace(/[\u4e00-\u9fa5]/g, '').trim();
      s = s.replace(/\(\s*\)/g, '').replace(/\/\s*\//g, '/').replace(/^\s*\/|\/\s*$/g, '').trim();
      return s;
    };

    const rawChars = Array.isArray(parsed.characters) ? parsed.characters : [];
    const characters = rawChars.map(c => ({
      ...c,
      vi: cleanStr(c.vi) || c.zh,
      role: cleanStr(c.role),
      notes: cleanStr(c.notes)
    }));

    const rawPronouns = Array.isArray(parsed.pronounMatrix) ? parsed.pronounMatrix : [];
    const pronounMatrix = rawPronouns.map(p => {
      const listenerCall = cleanStr(p.speakerCallsListener || p.listenerCallsListener || p.speakerCallsOther || '');
      const selfCall = cleanStr(p.speakerCallsSelf || '');
      return {
        ...p,
        speakerCallsSelf: selfCall || 'ta',
        speakerCallsListener: listenerCall || 'ngươi',
        notes: cleanStr(p.notes)
      };
    });

    const rawTerms = Array.isArray(parsed.terms) ? parsed.terms : [];
    const terms = rawTerms.map(t => ({
      ...t,
      vi: cleanStr(t.vi) || t.zh,
      category: cleanStr(t.category) || 'Thuật ngữ'
    }));

    return { characters, pronounMatrix, terms };
  } catch (e) {
    console.error('Error autoExtractEntities:', e);
    return { characters: [], pronounMatrix: [], terms: [] };
  }
}

// MAIN Cloudflare Pages Function Handler
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '');
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const db = env.DB;
  if (!db) {
    if (pathname.startsWith('/api')) {
      return json({
        warning: 'Cloudflare D1 chưa được gắn (binding "DB"). Vui lòng tạo D1 database và cấu hình binding "DB" trong Cloudflare Pages Settings.',
        isD1Ready: false
      });
    }
    return context.next();
  }

  await initDb(db);

  try {
    // ----------------------------------------------------
    // AUTHENTICATION & PASSWORD MANAGEMENT
    // ----------------------------------------------------
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await request.json();
      const inputPass = (body.password || '').trim();

      const row = await db.prepare("SELECT value FROM config WHERE key = 'admin_password'").first();
      const currentAdminPass = row && row.value ? row.value.trim() : 'lilyhub888';

      if (inputPass !== currentAdminPass) {
        return json({ success: false, message: 'Mật khẩu truy cập không chính xác!' }, 401);
      }

      const token = `token_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`;
      await db.prepare("INSERT INTO config (key, value) VALUES ('session_' || ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(token, JSON.stringify({ createdAt: Date.now() })).run();

      return json({ success: true, token, message: 'Đăng nhập thành công!' });
    }

    if (pathname === '/api/auth/check') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return json({ authenticated: false, message: 'Chưa đăng nhập' }, 401);
      }

      const row = await db.prepare("SELECT value FROM config WHERE key = 'session_' || ?").bind(token).first();
      if (!row) {
        return json({ authenticated: false, message: 'Phiên đăng nhập đã hết hạn' }, 401);
      }

      return json({ authenticated: true });
    }

    if (pathname === '/api/auth/change-password' && method === 'POST') {
      const body = await request.json();
      const { currentPassword, newPassword } = body;

      if (!newPassword || newPassword.trim().length < 4) {
        return errorJson('Mật khẩu mới phải có ít nhất 4 ký tự.', 400);
      }

      const row = await db.prepare("SELECT value FROM config WHERE key = 'admin_password'").first();
      const currentAdminPass = row && row.value ? row.value.trim() : 'lilyhub888';

      if ((currentPassword || '').trim() !== currentAdminPass) {
        return errorJson('Mật khẩu hiện tại không đúng!', 400);
      }

      await db.prepare("INSERT INTO config (key, value) VALUES ('admin_password', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(newPassword.trim()).run();

      return json({ success: true, message: 'Đổi mật khẩu thành công!' });
    }

    // ----------------------------------------------------
    // API KEYS
    // ----------------------------------------------------
    if (pathname === '/api/keys') {
      if (method === 'GET') {
        const keys = await getApiKeys(db, env);
        return json({
          keys: (keys || []).map(k => ({
            key: typeof k === 'object' ? (k.key || '') : k,
            status: 'active'
          }))
        });
      }
      if (method === 'POST') {
        const body = await request.json();
        const keys = Array.isArray(body.keys) ? body.keys : [body.keys];
        await db.prepare("INSERT INTO config (key, value) VALUES ('apiKeys', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .bind(JSON.stringify(keys)).run();
        return json({ success: true, keys: keys.map(k => ({ key: k, status: 'active' })) });
      }
    }

    if (pathname === '/api/keys/test' && method === 'POST') {
      const body = await request.json();
      const keys = await getApiKeys(db, env);
      const testKey = body.key || keys[0];
      if (!testKey) return errorJson('Chưa có key để test', 400);
      try {
        await callGemini([testKey], body.model || 'gemini-2.0-flash', 'Xin chào, trả lời OK.');
        return json({ success: true, message: 'API key hợp lệ và hoạt động tốt!' });
      } catch (e) {
        return json({ success: false, message: e.message });
      }
    }

    if (pathname === '/api/keys/reset' && method === 'POST') {
      const keys = await getApiKeys(db, env);
      return json({ success: true, keys: keys.map(k => ({ key: k, status: 'active' })) });
    }

    if (pathname === '/api/models' && method === 'GET') {
      return json([
        { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Khuyên dùng - Đời mới nhất, Nhanh & Chuẩn)' },
        { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Siêu tiết kiệm Quota)' },
        { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro (Chất lượng văn học cao cấp)' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
      ]);
    }

    // ----------------------------------------------------
    // PROJECTS
    // ----------------------------------------------------
    if (pathname === '/api/projects') {
      if (method === 'GET') {
        const { results } = await db.prepare(`
          SELECT p.*, COUNT(c.id) as chapterCount
          FROM projects p
          LEFT JOIN chapters c ON p.id = c.projectId
          GROUP BY p.id
          ORDER BY p.updatedAt DESC
        `).all();

        const formatted = (results || []).map(row => ({
          ...row,
          characters: JSON.parse(row.characters || '[]'),
          terms: JSON.parse(row.terms || '[]'),
          pronounMatrix: JSON.parse(row.pronounMatrix || '[]'),
          settings: JSON.parse(row.settings || '{}'),
          chapterCount: Number(row.chapterCount || 0)
        }));

        return json({ success: true, projects: formatted });
      }

      if (method === 'POST') {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();
        const now = new Date().toISOString();

        await db.prepare(`
          INSERT INTO projects (id, title, genre, toneGuidance, model, characters, terms, pronounMatrix, settings, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.title || 'Truyện mới',
          body.genre || 'Tiên Hiệp / Huyền Huyễn',
          body.toneGuidance || '',
          body.model || 'gemini-3.6-flash',
          JSON.stringify(body.characters || []),
          JSON.stringify(body.terms || []),
          JSON.stringify(body.pronounMatrix || []),
          JSON.stringify(body.settings || {}),
          now,
          now
        ).run();

        const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
        const projectData = {
          ...project,
          characters: JSON.parse(project.characters || '[]'),
          terms: JSON.parse(project.terms || '[]'),
          pronounMatrix: JSON.parse(project.pronounMatrix || '[]'),
          settings: JSON.parse(project.settings || '{}'),
          chapters: []
        };
        return json({
          success: true,
          project: projectData,
          ...projectData
        }, 201);
      }
    }

    // Single Project
    const projectMatch = pathname.match(/^\/api\/projects\/([^\/]+)$/);
    if (projectMatch) {
      const projectId = projectMatch[1];

      if (method === 'GET') {
        const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
        if (!project) return errorJson('Không tìm thấy dự án', 404);

        const { results: chapters } = await db.prepare(
          "SELECT * FROM chapters WHERE projectId = ? ORDER BY chapterIndex ASC"
        ).bind(projectId).all();

        const projectData = {
          ...project,
          characters: JSON.parse(project.characters || '[]'),
          terms: JSON.parse(project.terms || '[]'),
          pronounMatrix: JSON.parse(project.pronounMatrix || '[]'),
          settings: JSON.parse(project.settings || '{}'),
          chapters: (chapters || []).map(c => {
            const qa = JSON.parse(c.qaReport || '{}');
            return {
              ...c,
              qaReport: qa,
              pronounAudit: qa.pronounAudit || null,
              issues: JSON.parse(c.issues || '[]')
            };
          })
        };
        return json({
          success: true,
          project: projectData,
          ...projectData
        });
      }

      if (method === 'PUT') {
        const body = await request.json();
        const now = new Date().toISOString();

        await db.prepare(`
          UPDATE projects
          SET title = COALESCE(?, title),
              genre = COALESCE(?, genre),
              toneGuidance = COALESCE(?, toneGuidance),
              model = COALESCE(?, model),
              characters = COALESCE(?, characters),
              terms = COALESCE(?, terms),
              pronounMatrix = COALESCE(?, pronounMatrix),
              settings = COALESCE(?, settings),
              updatedAt = ?
          WHERE id = ?
        `).bind(
          body.title || null,
          body.genre || null,
          body.toneGuidance || null,
          body.model || null,
          body.characters ? JSON.stringify(body.characters) : null,
          body.terms ? JSON.stringify(body.terms) : null,
          body.pronounMatrix ? JSON.stringify(body.pronounMatrix) : null,
          body.settings ? JSON.stringify(body.settings) : null,
          now,
          projectId
        ).run();

        const updatedProject = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
        const { results: chapters } = await db.prepare("SELECT * FROM chapters WHERE projectId = ? ORDER BY chapterIndex ASC").bind(projectId).all();
        const projectData = {
          ...updatedProject,
          characters: JSON.parse(updatedProject.characters || '[]'),
          terms: JSON.parse(updatedProject.terms || '[]'),
          pronounMatrix: JSON.parse(updatedProject.pronounMatrix || '[]'),
          settings: JSON.parse(updatedProject.settings || '{}'),
          chapters: (chapters || []).map(c => {
            const qa = JSON.parse(c.qaReport || '{}');
            return {
              ...c,
              qaReport: qa,
              pronounAudit: qa.pronounAudit || null,
              issues: JSON.parse(c.issues || '[]')
            };
          })
        };
        return json({ success: true, project: projectData, ...projectData });
      }

      if (method === 'DELETE') {
        await db.batch([
          db.prepare("DELETE FROM chapters WHERE projectId = ?").bind(projectId),
          db.prepare("DELETE FROM projects WHERE id = ?").bind(projectId)
        ]);
        return json({ success: true, message: 'Đã xóa dự án thành công' });
      }
    }

    // ----------------------------------------------------
    // CHAPTER OPERATIONS
    // ----------------------------------------------------
    const singleChapMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/chapters\/([^\/]+)$/);
    if (singleChapMatch) {
      const [_, projectId, chapterId] = singleChapMatch;

      if (method === 'GET') {
        const ch = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();
        if (!ch) return errorJson('Chương không tồn tại', 404);
        return json({
          ...ch,
          qaReport: JSON.parse(ch.qaReport || '{}'),
          issues: JSON.parse(ch.issues || '[]')
        });
      }

      if (method === 'PUT') {
        const body = await request.json();
        const now = new Date().toISOString();

        await db.prepare(`
          UPDATE chapters
          SET title = COALESCE(?, title),
              originalText = COALESCE(?, originalText),
              translatedTitle = COALESCE(?, translatedTitle),
              translatedText = COALESCE(?, translatedText),
              status = COALESCE(?, status),
              summary = COALESCE(?, summary),
              qaReport = COALESCE(?, qaReport),
              issues = COALESCE(?, issues),
              chineseCharCount = COALESCE(?, chineseCharCount),
              updatedAt = ?
          WHERE id = ? AND projectId = ?
        `).bind(
          body.title || null,
          body.originalText || body.rawText || null,
          body.translatedTitle || null,
          body.translatedText !== undefined ? body.translatedText : null,
          body.status || null,
          body.summary || null,
          body.qaReport ? JSON.stringify(body.qaReport) : null,
          body.issues ? JSON.stringify(body.issues) : null,
          body.chineseCharCount !== undefined ? body.chineseCharCount : null,
          now,
          chapterId,
          projectId
        ).run();

        const updated = await db.prepare("SELECT * FROM chapters WHERE id = ?").bind(chapterId).first();
        return json({
          success: true,
          chapter: {
            ...updated,
            qaReport: JSON.parse(updated.qaReport || '{}'),
            issues: JSON.parse(updated.issues || '[]')
          }
        });
      }

      if (method === 'DELETE') {
        await db.prepare("DELETE FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).run();
        return json({ success: true });
      }
    }

    // Import text: /api/projects/:id/import-text
    const importMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/import-text$/);
    if (importMatch && method === 'POST') {
      const projectId = importMatch[1];
      const body = await request.json();
      const rawText = body.text || '';
      const singleChapter = Boolean(body.singleChapter);
      const customPattern = body.customPattern || '';

      const matches = splitTextIntoChapters(rawText, {
        singleChapter,
        customPattern,
        fallbackTitle: body.customTitle || 'Chương 1'
      });

      const now = new Date().toISOString();
      const countRow = await db.prepare("SELECT COUNT(*) as count FROM chapters WHERE projectId = ?").bind(projectId).first();
      const startIndex = countRow ? Number(countRow.count || 0) : 0;

      const CHUNK_SIZE = 50;
      for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
        const chunk = matches.slice(i, i + CHUNK_SIZE);
        const stmts = chunk.map((m, idx) => {
          const chId = crypto.randomUUID();
          return db.prepare(`
            INSERT INTO chapters (id, projectId, title, chapterIndex, originalText, status, qaReport, issues, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'pending', '{}', '[]', ?, ?)
          `).bind(chId, projectId, m.title, startIndex + i + idx, m.content, now, now);
        });
        await db.batch(stmts);
      }

      return json({ success: true, count: matches.length });
    }

    // Upload file: /api/projects/:id/upload
    const uploadMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/upload$/);
    if (uploadMatch && method === 'POST') {
      const projectId = uploadMatch[1];
      const formData = await request.formData();
      const file = formData.get('file');
      const singleChapter = formData.get('singleChapter') === 'true';
      const customPattern = formData.get('customPattern') || '';

      if (!file) return errorJson('Vui lòng chọn file tải lên', 400);

      const fileName = file.name || 'document.txt';
      const arrayBuffer = await file.arrayBuffer();
      let rawText = '';

      if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
        try {
          rawText = await extractDocxText(arrayBuffer);
        } catch (e) {
          console.warn('Docx extract error, fallback:', e.message);
          rawText = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        }
      } else if (fileName.toLowerCase().endsWith('.epub')) {
        rawText = await extractEpubText(arrayBuffer);
      } else {
        try {
          const dec = new TextDecoder('utf-8', { fatal: true });
          rawText = dec.decode(arrayBuffer);
        } catch (e) {
          try {
            const decGb = new TextDecoder('gb18030');
            rawText = decGb.decode(arrayBuffer);
          } catch (e2) {
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
          }
        }
      }

      if (!rawText || !rawText.trim()) {
        return errorJson('File trống hoặc không thể trích xuất văn bản', 400);
      }

      const defaultTitle = fileName.replace(/\.[^/.]+$/, "") || 'Chương 1';
      const matches = splitTextIntoChapters(rawText, {
        singleChapter,
        customPattern,
        fallbackTitle: defaultTitle
      });

      const now = new Date().toISOString();
      const countRow = await db.prepare("SELECT COUNT(*) as count FROM chapters WHERE projectId = ?").bind(projectId).first();
      const startIndex = countRow ? Number(countRow.count || 0) : 0;

      const CHUNK_SIZE = 50;
      for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
        const chunk = matches.slice(i, i + CHUNK_SIZE);
        const stmts = chunk.map((m, idx) => {
          const chId = crypto.randomUUID();
          return db.prepare(`
            INSERT INTO chapters (id, projectId, title, chapterIndex, originalText, status, qaReport, issues, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'pending', '{}', '[]', ?, ?)
          `).bind(chId, projectId, m.title, startIndex + i + idx, m.content, now, now);
        });
        await db.batch(stmts);
      }

      return json({ success: true, count: matches.length });
    }

    // Split single chapter into multiple: /api/projects/:id/chapters/:chapterId/split
    const splitMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/chapters\/([^\/]+)\/split$/);
    if (splitMatch && method === 'POST') {
      const [_, projectId, chapterId] = splitMatch;
      const body = await request.json();
      const { customPattern } = body;

      const chapter = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();
      if (!chapter) return errorJson('Không tìm thấy chương', 404);

      const parts = splitTextIntoChapters(chapter.originalText, { customPattern });
      if (parts.length < 2) {
        return errorJson('Không tìm thấy thêm phân đoạn chương nào bên trong chương này. Hãy kiểm tra từ khóa phân tách.', 400);
      }

      const now = new Date().toISOString();

      // Shift index of succeeding chapters by (parts.length - 1)
      const addedCount = parts.length - 1;
      await db.prepare(`
        UPDATE chapters
        SET chapterIndex = chapterIndex + ?
        WHERE projectId = ? AND chapterIndex > ?
      `).bind(addedCount, projectId, chapter.chapterIndex).run();

      // Update current chapter with part 0
      await db.prepare(`
        UPDATE chapters
        SET title = COALESCE(?, title),
            originalText = ?,
            translatedText = '',
            status = 'pending',
            updatedAt = ?
        WHERE id = ?
      `).bind(parts[0].title || chapter.title, parts[0].content, now, chapterId).run();

      // Insert remaining parts as new chapters
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        const newId = crypto.randomUUID();
        await db.prepare(`
          INSERT INTO chapters (id, projectId, title, chapterIndex, originalText, status, qaReport, issues, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'pending', '{}', '[]', ?, ?)
        `).bind(newId, projectId, p.title, chapter.chapterIndex + i, p.content, now, now).run();
      }

      return json({ success: true, count: parts.length, message: `Đã tách thành công thành ${parts.length} chương!` });
    }

    // Auto-scan characters & pronoun matrix: /api/projects/:id/auto-scan
    const autoScanMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/auto-scan$/);
    if (autoScanMatch && method === 'POST') {
      const projectId = autoScanMatch[1];
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      let body = {};
      try { body = await request.json(); } catch (e) {}

      let sample = body.sampleText || '';
      if (!sample) {
        const { results: allChaps } = await db.prepare(
          "SELECT title, originalText, chapterIndex FROM chapters WHERE projectId = ? ORDER BY chapterIndex ASC"
        ).bind(projectId).all();

        if (allChaps && allChaps.length > 0) {
          let chosenChaps = [];
          if (allChaps.length <= 6) {
            chosenChaps = allChaps;
          } else if (body.scanMode === 'recent') {
            chosenChaps = allChaps.slice(-6);
          } else {
            // Multi-point sampling across the entire novel (beginning, middle, and later chapters)
            const step = Math.max(1, Math.floor(allChaps.length / 8));
            chosenChaps.push(allChaps[0], allChaps[1]);
            for (let idx = step; idx < allChaps.length - 2; idx += step) {
              if (!chosenChaps.some(c => c.chapterIndex === allChaps[idx].chapterIndex)) {
                chosenChaps.push(allChaps[idx]);
              }
            }
            chosenChaps.push(allChaps[allChaps.length - 1]);
          }
          sample = chosenChaps.slice(0, 10).map(c => `${c.title}\n${(c.originalText || '').slice(0, 2500)}`).join('\n\n---\n\n');
        }
      }

      if (!sample || !sample.trim()) {
        return errorJson('Chưa có chương truyện nào trong dự án để AI phân tích!', 400);
      }

      const keys = await getApiKeys(db, env);
      const extracted = await autoExtractEntities(keys, project.model || 'gemini-3.6-flash', sample, project.genre);

      const existingChars = JSON.parse(project.characters || '[]');
      const existingPronouns = JSON.parse(project.pronounMatrix || '[]');
      const existingTerms = JSON.parse(project.terms || '[]');

      const mergedChars = [...existingChars];
      for (const c of extracted.characters) {
        if (c.zh && !mergedChars.some(x => x.zh === c.zh || (x.vi && c.vi && x.vi.toLowerCase() === c.vi.toLowerCase()))) {
          mergedChars.push({ id: crypto.randomUUID(), ...c });
        }
      }

      const mergedPronouns = [...existingPronouns];
      for (const p of extracted.pronounMatrix) {
        if (p.speakerZh && p.listenerZh) {
          const exists = mergedPronouns.some(x =>
            (x.speakerZh === p.speakerZh && x.listenerZh === p.listenerZh) ||
            (x.speakerCallsSelf === p.speakerCallsSelf && x.speakerCallsListener === p.speakerCallsListener && x.speakerZh === p.speakerZh)
          );
          if (!exists) {
            mergedPronouns.push({ id: crypto.randomUUID(), ...p });
          }
        }
      }

      const mergedTerms = [...existingTerms];
      for (const t of extracted.terms) {
        if (t.zh && !mergedTerms.some(x => x.zh === t.zh)) {
          mergedTerms.push({ id: crypto.randomUUID(), ...t });
        }
      }

      const now = new Date().toISOString();
      await db.prepare(`
        UPDATE projects
        SET characters = ?, pronounMatrix = ?, terms = ?, updatedAt = ?
        WHERE id = ?
      `).bind(
        JSON.stringify(mergedChars),
        JSON.stringify(mergedPronouns),
        JSON.stringify(mergedTerms),
        now,
        projectId
      ).run();

      const updatedProj = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      const { results: allChaps } = await db.prepare("SELECT * FROM chapters WHERE projectId = ? ORDER BY chapterIndex ASC").bind(projectId).all();

      const projectData = {
        ...updatedProj,
        characters: mergedChars,
        pronounMatrix: mergedPronouns,
        terms: mergedTerms,
        settings: JSON.parse(updatedProj.settings || '{}'),
        chapters: (allChaps || []).map(c => ({
          ...c,
          qaReport: JSON.parse(c.qaReport || '{}'),
          issues: JSON.parse(c.issues || '[]')
        }))
      };

      return json({
        success: true,
        added: {
          characters: mergedChars.length - existingChars.length,
          pronounMatrix: mergedPronouns.length - existingPronouns.length,
          terms: mergedTerms.length - existingTerms.length
        },
        project: projectData
      });
    }

    // Import Vietphrase: /api/projects/:id/import-vietphrase
    const importVpMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/import-vietphrase$/);
    if (importVpMatch && method === 'POST') {
      const projectId = importVpMatch[1];
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const body = await request.json();
      const content = body.content || '';
      const existingTerms = JSON.parse(project.terms || '[]');
      const lines = content.split('\n');
      let count = 0;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('//') || line.startsWith('#')) continue;
        const [mainPart, notes] = line.split('#');
        const [zh, vi] = mainPart.split('=');
        if (zh && vi) {
          const cleanZh = zh.trim();
          const cleanVi = vi.trim();
          if (!existingTerms.some(t => t.zh === cleanZh)) {
            existingTerms.push({
              id: crypto.randomUUID(),
              zh: cleanZh,
              vi: cleanVi,
              category: notes ? notes.trim() : 'Vietphrase'
            });
            count++;
          }
        }
      }

      const now = new Date().toISOString();
      await db.prepare("UPDATE projects SET terms = ?, updatedAt = ? WHERE id = ?").bind(JSON.stringify(existingTerms), now, projectId).run();
      return json({ success: true, importedCount: count, terms: existingTerms });
    }

    // Export Vietphrase: /api/projects/:id/export-vietphrase
    const exportVpMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/export-vietphrase$/);
    if (exportVpMatch && method === 'GET') {
      const projectId = exportVpMatch[1];
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const characters = JSON.parse(project.characters || '[]');
      const terms = JSON.parse(project.terms || '[]');

      let lines = ['# === DANH TỪ RIÊNG & NHÂN VẬT (DICHTRUYENPRO) ==='];
      for (const c of characters) {
        lines.push(`${c.zh}=${c.vi}#Nhân vật (${c.gender || 'chưa rõ'}) - ${c.role || ''}`);
      }
      lines.push('\n# === THUẬT NGỮ & ĐỊA DANH ===');
      for (const t of terms) {
        lines.push(`${t.zh}=${t.vi}#${t.category || 'Thuật ngữ'}`);
      }

      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="Names_${projectId.slice(0, 8)}.txt"`
        }
      });
    }

    // Translate chapter: /api/projects/:id/translate-chapter/:chapterId
    const transMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/translate-chapter\/([^\/]+)$/);
    if (transMatch && method === 'POST') {
      const [_, projectId, chapterId] = transMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      const chapter = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();

      if (!project || !chapter) return errorJson('Không tìm thấy dự án hoặc chương', 404);

      const keys = await getApiKeys(db, env);
      let characters = JSON.parse(project.characters || '[]');
      let terms = JSON.parse(project.terms || '[]');
      let pronounMatrix = JSON.parse(project.pronounMatrix || '[]');

      // CONTINUOUS LEARNING: Auto-discover new characters and pronoun pairs as story unfolds!
      let entitiesExtracted = false;
      const shouldDiscover = 
        (characters.length === 0) || 
        (characters.length < 20) || 
        (Number(chapter.chapterIndex || 0) % 2 === 0);

      if (shouldDiscover && chapter.originalText) {
        try {
          const autoExtracted = await autoExtractEntities(keys, project.model || 'gemini-3.6-flash', chapter.originalText.slice(0, 6000), project.genre);
          let hasNew = false;

          for (const c of autoExtracted.characters) {
            if (c.zh && !characters.some(x => x.zh === c.zh || (x.vi && c.vi && x.vi.toLowerCase() === c.vi.toLowerCase()))) {
              characters.push({ id: crypto.randomUUID(), ...c });
              hasNew = true;
            }
          }

          for (const p of autoExtracted.pronounMatrix) {
            if (p.speakerZh && p.listenerZh) {
              const exists = pronounMatrix.some(x =>
                (x.speakerZh === p.speakerZh && x.listenerZh === p.listenerZh) ||
                (x.speakerCallsSelf === p.speakerCallsSelf && x.speakerCallsListener === p.speakerCallsListener && x.speakerZh === p.speakerZh)
              );
              if (!exists) {
                pronounMatrix.push({ id: crypto.randomUUID(), ...p });
                hasNew = true;
              }
            }
          }

          for (const t of autoExtracted.terms) {
            if (t.zh && !terms.some(x => x.zh === t.zh)) {
              terms.push({ id: crypto.randomUUID(), ...t });
              hasNew = true;
            }
          }

          if (hasNew) {
            const nowTime = new Date().toISOString();
            await db.prepare(`
              UPDATE projects
              SET characters = ?, pronounMatrix = ?, terms = ?, updatedAt = ?
              WHERE id = ?
            `).bind(JSON.stringify(characters), JSON.stringify(pronounMatrix), JSON.stringify(terms), nowTime, projectId).run();
            entitiesExtracted = true;
          }
        } catch (e) {
          console.warn('Continuous learning during translation warning:', e.message);
        }
      }

      const isBachHop = (project.genre || '').toLowerCase().includes('bách hợp');
      const isCoDai = (project.genre || '').toLowerCase().includes('cổ đại') || (project.genre || '').toLowerCase().includes('cung đấu');

      let genreGuidance = '';
      if (isBachHop) {
        genreGuidance += `\n- BỐI CẢNH BÁCH HỢP (GL - NỮ X NỮ): Các nhân vật chính (như Ôn Trì, Đỗ Chiêu Ly) đều là PHÁI NỮ. Ngôi dẫn chuyện phải xưng là "nàng" hoặc "cô", TUYỆT ĐỐI KHÔNG dùng "hắn" và không được đổi giới tính nhân vật thành nam!\n`;
      }
      if (isCoDai) {
        genreGuidance += `\n- BỐI CẢNH CỔ ĐẠI / CUNG ĐÌNH: Xưng hô hoàng tộc - thứ dân phải chuẩn mực (Thầy thuốc / thảo dân trước mặt Hoàng hậu tự xưng "thảo dân" hoặc "dân nữ", gọi Hoàng hậu là "nương nương"; Hoàng hậu tự xưng "bản cung"; Hoàng đế tự xưng "trẫm"). Thứ dân KHÔNG được tự xưng "trẫm".\n`;
      }

      let sysPrompt = `Bạn là dịch giả văn học nghệ thuật chuyên nghiệp dịch tác phẩm tiểu thuyết từ tiếng Trung sang tiếng Việt. Văn bản là tác phẩm văn nghệ hư cấu hoàn toàn.\n${genreGuidance}`;
      if (project.toneGuidance) sysPrompt += `\nĐẶC TẢ VĂN PHONG:\n${project.toneGuidance}\n`;

      if (characters.length > 0) {
        sysPrompt += `\nNHÂN VẬT & NGÔI DẪN CHUYỆN BẮT BUỘC:\n`;
        characters.forEach(c => {
          sysPrompt += `- ${c.zh} → ${c.vi} (Giới tính: ${c.gender || 'Chưa rõ'}). Ngôi dẫn truyện luôn xưng: "${c.narrativePronoun || (c.gender === 'Nữ' ? 'nàng' : 'hắn')}". ${c.notes || ''}\n`;
        });
      }

      if (pronounMatrix.length > 0) {
        sysPrompt += `\nMA TRẬN XƯNG HÔ ĐỐI THOẠI BẮT BUỘC:\n`;
        pronounMatrix.forEach(p => {
          sysPrompt += `- Khi ${p.speakerZh} nói chuyện với ${p.listenerZh}: tự xưng "${p.speakerCallsSelf}", gọi đối phương là "${p.speakerCallsListener}". ${p.notes || ''}\n`;
        });
      }

      if (terms.length > 0) {
        sysPrompt += `\nTHUẬT NGỮ / ĐỊA DANH CỐ ĐỊNH:\n`;
        terms.slice(0, 50).forEach(t => {
          sysPrompt += `- ${t.zh} → ${t.vi}\n`;
        });
      }

      sysPrompt += `\nQUY TẮC ĐẦU RA BẮT BUỘC:
- Dòng 1: Tiêu đề chương dịch hoàn chỉnh sang tiếng Việt (Ví dụ: "Chương 1: Yết Bảng" hoặc "Chương 2: Nhập Cung" hoặc "Chương 2: Lai Giả Bất Thiện" hoặc "Giới Thiệu & Văn Án").
- Dòng 2 trở đi: Toàn bộ nội dung chương dịch. Giữ nguyên 100% kết cấu phân đoạn và ngắt dòng của bản gốc.
- Dịch đầy đủ 100%, không tóm tắt hay lược bỏ bất kỳ câu nào.
- TUYỆT ĐỐI KHÔNG ĐỂ SÓT BẤT KỲ CHỮ HÁN NÀO trong bản dịch! Tất cả danh xưng, tên người (như Tử Lan, Ngô Vạn, Hà Tư Trung, An Lạc), địa danh, y quán chức vụ (như Ngự dược thự, Thái y viện, Thọ yến), lời đối thoại và từ đệm PHẢI được dịch 100% sang tiếng Việt / Hán Việt. Tuyệt đối cấm để lọt dạng nửa Hán nửa Việt như "Tử兰" hay "Ngô万".
- TUYỆT ĐỐI KHÔNG dùng đại từ hiện đại ("tôi", "anh", "em", "cô ấy") trong lời thoại truyện cổ đại / hoàng cung. Kẻ dưới trước mặt Hoàng thượng xưng "thảo dân", gọi "Hoàng thượng / Bệ hạ"; trước mặt Hoàng hậu xưng "thảo dân" (hoặc "dân nữ"), gọi "Nương nương".
- Chỉ xuất ra DUY NHẤT bản dịch tiếng Việt, không kèm lời chào hỏi, mở đầu hay ghi chú.`;

      const titleToTranslate = chapter.title || '';
      const prompt = `[BỐI CẢNH VĂN HỌC NGHỆ THUẬT HƯ CẤU - TIỂU THUYẾT NGHỆ THUẬT / Y THUẬT TRUYỀN THỐNG]\nDịch tiêu đề và toàn bộ nội dung chương tiểu thuyết sau sang tiếng Việt hoàn chỉnh:\n\nTIÊU ĐỀ GỐC:\n${titleToTranslate}\n\nNỘI DUNG GỐC:\n${chapter.originalText}`;
      const translated = await callGemini(keys, project.model || 'gemini-3.6-flash', prompt, sysPrompt);

      const lines = translated.trim().split('\n');
      let finalTranslatedTitle = chapter.translatedTitle || '';
      let finalTranslatedBody = translated;

      if (lines.length > 1 && lines[0].trim().length < 150) {
        finalTranslatedTitle = lines[0].trim().replace(/^#+\s*/, '').replace(/^\[?Tiêu đề[^:\]]*[:\]]\s*/i, '');
        finalTranslatedBody = lines.slice(1).join('\n').trim();
      } else if (!finalTranslatedTitle || /[\u4e00-\u9fa5]/.test(finalTranslatedTitle)) {
        finalTranslatedTitle = chapter.title;
      }

      finalTranslatedTitle = autoFixContent(finalTranslatedTitle);
      finalTranslatedBody = autoFixContent(finalTranslatedBody);

      const qa = auditText(finalTranslatedBody, chapter.originalText, { characters, terms, pronounMatrix });
      const now = new Date().toISOString();

      await db.prepare(`
        UPDATE chapters
        SET translatedText = ?,
            translatedTitle = ?,
            status = 'completed',
            qaReport = ?,
            issues = ?,
            chineseCharCount = ?,
            updatedAt = ?
        WHERE id = ?
      `).bind(
        finalTranslatedBody,
        finalTranslatedTitle,
        JSON.stringify(qa),
        JSON.stringify(qa.issues.map(i => i.message)),
        qa.stats.chineseCharCount,
        now,
        chapterId
      ).run();

      const updatedChap = await db.prepare("SELECT * FROM chapters WHERE id = ?").bind(chapterId).first();

      let updatedProjectData = null;
      if (entitiesExtracted) {
        const p = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
        updatedProjectData = {
          ...p,
          characters,
          pronounMatrix,
          terms,
          settings: JSON.parse(p?.settings || '{}')
        };
      }

      return json({
        success: true,
        chapter: {
          ...updatedChap,
          qaReport: qa,
          issues: qa.issues.map(i => i.message)
        },
        project: updatedProjectData,
        updatedProject: updatedProjectData
      });
    }

    // 1-Click Auto-Fix: /api/projects/:id/auto-fix-chapter/:chapterId
    const autoFixMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/auto-fix-chapter\/([^\/]+)$/);
    if (autoFixMatch && method === 'POST') {
      const [_, projectId, chapterId] = autoFixMatch;
      const body = await request.json();

      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      const chapter = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();
      if (!chapter) return errorJson('Không tìm thấy chương', 404);

      const input = body.text || chapter.translatedText || '';
      const fixed = autoFixContent(input);

      const qa = auditText(fixed, chapter.originalText, {
        characters: JSON.parse(project?.characters || '[]'),
        terms: JSON.parse(project?.terms || '[]')
      });

      const now = new Date().toISOString();
      await db.prepare(`
        UPDATE chapters
        SET translatedText = ?,
            qaReport = ?,
            issues = ?,
            chineseCharCount = ?,
            updatedAt = ?
        WHERE id = ?
      `).bind(
        fixed,
        JSON.stringify(qa),
        JSON.stringify(qa.issues.map(i => i.message)),
        qa.stats.chineseCharCount,
        now,
        chapterId
      ).run();

      const updated = await db.prepare("SELECT * FROM chapters WHERE id = ?").bind(chapterId).first();
      return json({
        success: true,
        chapter: {
          ...updated,
          qaReport: qa,
          issues: qa.issues.map(i => i.message)
        },
        qaReport: qa
      });
    }

    // Audit Chapter: /api/projects/:id/audit-chapter/:chapterId
    const auditMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/audit-chapter\/([^\/]+)$/);
    if (auditMatch && method === 'POST') {
      const [_, projectId, chapterId] = auditMatch;
      const body = await request.json();

      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      const chapter = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();
      if (!chapter) return errorJson('Không tìm thấy chương', 404);

      const textToAudit = body.text || chapter.translatedText || '';
      const qa = auditText(textToAudit, chapter.originalText, {
        characters: JSON.parse(project?.characters || '[]'),
        terms: JSON.parse(project?.terms || '[]')
      });

      return json({ success: true, qaReport: qa });
    }

    // Targeted AI Fix: /api/projects/:id/targeted-fix/:chapterId
    const fixMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/targeted-fix\/([^\/]+)$/);
    if (fixMatch && method === 'POST') {
      const [_, projectId, chapterId] = fixMatch;
      const body = await request.json();
      const { selectedText, instruction, fullText } = body;

      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      const chapter = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();
      if (!chapter) return errorJson('Không tìm thấy chương', 404);

      const keys = await getApiKeys(db, env);
      const fixPrompt = `Bạn là biên tập viên cao cấp. Sửa lại duy nhất đoạn văn bản sau theo yêu cầu:\n` +
        `YÊU CẦU: ${instruction || 'Sửa lại tiếng Việt tự nhiên, sạch chữ Hán, xưng hô chuẩn xác.'}\n` +
        `ĐOẠN CẦN SỬA: "${selectedText}"\n\n` +
        `Chỉ trả về đoạn văn bản đã sửa, không thêm bất kỳ lời dẫn nào:`;

      const fixedSnippet = await callGemini(keys, project?.model || 'gemini-3.6-flash', fixPrompt);
      const cleaned = fixedSnippet.trim().replace(/^["']|["']$/g, '');

      let currentFull = fullText || chapter.translatedText || '';
      if (selectedText && currentFull.includes(selectedText)) {
        currentFull = currentFull.replace(selectedText, cleaned);
      }

      const qa = auditText(currentFull, chapter.originalText, {
        characters: JSON.parse(project?.characters || '[]'),
        terms: JSON.parse(project?.terms || '[]')
      });

      const now = new Date().toISOString();
      await db.prepare(`
        UPDATE chapters
        SET translatedText = ?,
            qaReport = ?,
            issues = ?,
            chineseCharCount = ?,
            updatedAt = ?
        WHERE id = ?
      `).bind(
        currentFull,
        JSON.stringify(qa),
        JSON.stringify(qa.issues.map(i => i.message)),
        qa.stats.chineseCharCount,
        now,
        chapterId
      ).run();

      const updated = await db.prepare("SELECT * FROM chapters WHERE id = ?").bind(chapterId).first();
      return json({
        success: true,
        fixedSnippet: cleaned,
        translatedText: currentFull,
        qaReport: qa,
        chapter: {
          ...updated,
          qaReport: qa
        }
      });
    }

    // Pronoun Consistency Cross-Chapter Audit: /api/projects/:id/pronoun-consistency
    const pronounConsistencyMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/pronoun-consistency$/);
    if (pronounConsistencyMatch && method === 'GET') {
      const [_, projectId] = pronounConsistencyMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const characters = JSON.parse(project.characters || '[]');
      const pronounMatrix = JSON.parse(project.pronounMatrix || '[]');

      const { results: chapters } = await db.prepare(
        "SELECT id, chapterIndex, title, translatedTitle, translatedText, qaReport, status FROM chapters WHERE projectId = ? AND (status = 'completed' OR translatedText IS NOT NULL) ORDER BY chapterIndex ASC"
      ).bind(projectId).all();

      const inconsistencies = [];
      const crossChapterPairsMap = new Map();
      let totalPairsChecked = 0;

      for (const ch of (chapters || [])) {
        const text = ch.translatedText || '';
        if (!text.trim()) continue;

        // Extract pronouns for this chapter
        const audit = extractPronounAudit(text, characters, pronounMatrix);

        // Check for modern pronouns in dialogues
        const quotes = text.match(/[“"][^”"\n]{3,150}[”"]/g) || [];
        for (const q of quotes) {
          if (/(?:Hoàng thượng|Bệ hạ|nương nương|Hoàng hậu)/i.test(q) && /\btôi\b/i.test(q)) {
            inconsistencies.push({
              chapterId: ch.id,
              chapterIndex: ch.chapterIndex,
              chapterTitle: ch.translatedTitle || ch.title,
              severity: 'warning',
              issue: 'Xưng hô hiện đại "tôi" trước mặt Hoàng thượng / Nương nương',
              snippet: q.slice(0, 100),
              suggestedFix: 'Đổi thành "thảo dân" hoặc "dân nữ"'
            });
          }
        }

        // Aggregate pairs across chapters
        for (const p of audit.pronounPairs) {
          totalPairsChecked++;
          const pairKey = `${p.speaker} ➔ ${p.listener}`;
          if (!crossChapterPairsMap.has(pairKey)) {
            crossChapterPairsMap.set(pairKey, {
              speaker: p.speaker,
              listener: p.listener,
              speakerSelf: p.speakerCallsSelf,
              speakerCallsOther: p.speakerCallsOther,
              chapters: [ch.chapterIndex],
              isConsistent: p.status !== 'inconsistent'
            });
          } else {
            const entry = crossChapterPairsMap.get(pairKey);
            if (!entry.chapters.includes(ch.chapterIndex)) {
              entry.chapters.push(ch.chapterIndex);
            }
            if (p.status === 'inconsistent') {
              entry.isConsistent = false;
            }
          }
        }
      }

      const crossChapterMatrix = Array.from(crossChapterPairsMap.values());
      const consistencyRate = totalPairsChecked > 0
        ? Math.max(0, Math.min(100, Math.round(((totalPairsChecked - inconsistencies.length) / totalPairsChecked) * 1000) / 10))
        : 100;

      return json({
        success: true,
        overallConsistency: consistencyRate,
        totalChaptersAudited: (chapters || []).length,
        totalPairsAudited: totalPairsChecked,
        crossChapterMatrix,
        inconsistencies,
        matrixRulesCount: pronounMatrix.length,
        charactersCount: characters.length
      });
    }

    // Batch Auto-Fix Pronouns & Hanzi across ALL completed chapters: /api/projects/:id/batch-fix-pronouns
    const batchFixMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/batch-fix-pronouns$/);
    if (batchFixMatch && method === 'POST') {
      const [_, projectId] = batchFixMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const characters = JSON.parse(project.characters || '[]');
      const terms = JSON.parse(project.terms || '[]');
      const pronounMatrix = JSON.parse(project.pronounMatrix || '[]');

      const { results: chapters } = await db.prepare(
        "SELECT id, chapterIndex, title, originalText, translatedTitle, translatedText FROM chapters WHERE projectId = ? AND (status = 'completed' OR translatedText IS NOT NULL) ORDER BY chapterIndex ASC"
      ).bind(projectId).all();

      let fixedCount = 0;
      let totalHanziCleaned = 0;
      const now = new Date().toISOString();

      for (const ch of (chapters || [])) {
        if (!ch.translatedText) continue;
        const origText = ch.translatedText;
        const cleanedText = autoFixContent(ch.translatedText);
        const cleanedTitle = autoFixContent(ch.translatedTitle || ch.title);

        const hanBefore = (origText.match(/[\u4e00-\u9fa5]/g) || []).length;
        const hanAfter = (cleanedText.match(/[\u4e00-\u9fa5]/g) || []).length;
        totalHanziCleaned += Math.max(0, hanBefore - hanAfter);

        const qa = auditText(cleanedText, ch.originalText, { characters, terms, pronounMatrix });

        await db.prepare(`
          UPDATE chapters
          SET translatedText = ?,
              translatedTitle = ?,
              qaReport = ?,
              issues = ?,
              chineseCharCount = ?,
              updatedAt = ?
          WHERE id = ?
        `).bind(
          cleanedText,
          cleanedTitle,
          JSON.stringify(qa),
          JSON.stringify(qa.issues.map(i => i.message)),
          qa.stats.chineseCharCount,
          now,
          ch.id
        ).run();

        fixedCount++;
      }

      return json({
        success: true,
        message: `Đã chuẩn hóa và làm sạch thành công ${fixedCount} chương! Đã triệt tiêu ${totalHanziCleaned} chữ Hán tồn đọng.`,
        fixedChaptersCount: fixedCount,
        totalHanziCleaned
      });
    }

    // Batch Replace Preview: /api/projects/:id/batch-replace/preview
    const batchReplacePrevMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/batch-replace\/preview$/);
    if (batchReplacePrevMatch && method === 'POST') {
      const [_, projectId] = batchReplacePrevMatch;
      const body = await request.json();
      const { rules = [], scope = 'story', chapterId = null, wholeWord = false } = body;

      const validRules = (rules || []).filter(r => String(r.find || '').trim().length > 0);
      if (!validRules.length) return json({ success: true, totalMatches: 0, chapterCount: 0, chapterMatches: [] });

      let query = "SELECT id, chapterIndex, title, translatedTitle, translatedText FROM chapters WHERE projectId = ? AND (status = 'completed' OR translatedText IS NOT NULL)";
      const params = [projectId];
      if (scope === 'chapter' && chapterId) {
        query += " AND id = ?";
        params.push(chapterId);
      }
      query += " ORDER BY chapterIndex ASC";

      const { results: chapters } = await db.prepare(query).bind(...params).all();

      let totalMatches = 0;
      const chapterMatches = [];

      for (const ch of (chapters || [])) {
        const text = ch.translatedText || '';
        if (!text) continue;
        const prev = previewReplacements(text, validRules, wholeWord);
        if (prev.count > 0) {
          totalMatches += prev.count;
          chapterMatches.push({
            chapterId: ch.id,
            chapterIndex: ch.chapterIndex,
            title: ch.translatedTitle || ch.title,
            count: prev.count,
            samples: prev.samples
          });
        }
      }

      return json({
        success: true,
        totalMatches,
        chapterCount: chapterMatches.length,
        chapterMatches
      });
    }

    // Batch Replace Apply: /api/projects/:id/batch-replace/apply
    const batchReplaceApplyMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/batch-replace\/apply$/);
    if (batchReplaceApplyMatch && method === 'POST') {
      const [_, projectId] = batchReplaceApplyMatch;
      const body = await request.json();
      const { rules = [], scope = 'story', chapterId = null, wholeWord = false } = body;

      const validRules = (rules || []).filter(r => String(r.find || '').trim().length > 0);
      if (!validRules.length) return errorJson('Không có quy tắc thay thế hợp lệ', 400);

      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      let query = "SELECT id, chapterIndex, title, originalText, translatedTitle, translatedText, qaReport, issues, chineseCharCount FROM chapters WHERE projectId = ? AND (status = 'completed' OR translatedText IS NOT NULL)";
      const params = [projectId];
      if (scope === 'chapter' && chapterId) {
        query += " AND id = ?";
        params.push(chapterId);
      }
      query += " ORDER BY chapterIndex ASC";

      const { results: chapters } = await db.prepare(query).bind(...params).all();

      const characters = JSON.parse(project.characters || '[]');
      const terms = JSON.parse(project.terms || '[]');
      const pronounMatrix = JSON.parse(project.pronounMatrix || '[]');
      const settings = JSON.parse(project.settings || '{}');

      // Save undo snapshot
      const undoRows = (chapters || []).map(ch => ({
        id: ch.id,
        translatedText: ch.translatedText,
        translatedTitle: ch.translatedTitle,
        qaReport: ch.qaReport,
        issues: ch.issues,
        chineseCharCount: ch.chineseCharCount
      }));

      settings.lastBatchReplaceUndo = {
        timestamp: new Date().toISOString(),
        scope,
        rules: validRules,
        rows: undoRows
      };

      await db.prepare("UPDATE projects SET settings = ? WHERE id = ?").bind(JSON.stringify(settings), projectId).run();

      let totalReplaced = 0;
      let chaptersUpdated = 0;
      const now = new Date().toISOString();

      for (const ch of (chapters || [])) {
        const origText = ch.translatedText || '';
        const rep = applyReplacements(origText, validRules, wholeWord);
        if (rep.count > 0) {
          totalReplaced += rep.count;
          chaptersUpdated++;

          const cleanedText = autoFixContent(rep.text);
          const qa = auditText(cleanedText, ch.originalText, { characters, terms, pronounMatrix });

          await db.prepare(`
            UPDATE chapters
            SET translatedText = ?,
                qaReport = ?,
                issues = ?,
                chineseCharCount = ?,
                updatedAt = ?
            WHERE id = ?
          `).bind(
            cleanedText,
            JSON.stringify(qa),
            JSON.stringify(qa.issues.map(i => i.message)),
            qa.stats.chineseCharCount,
            now,
            ch.id
          ).run();
        }
      }

      return json({
        success: true,
        message: `Đã thay thế thành công ${totalReplaced} vị trí trong ${chaptersUpdated} chương!`,
        totalReplaced,
        chaptersUpdated,
        canUndo: true
      });
    }

    // Batch Replace Undo: /api/projects/:id/batch-replace/undo
    const batchReplaceUndoMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/batch-replace\/undo$/);
    if (batchReplaceUndoMatch && method === 'POST') {
      const [_, projectId] = batchReplaceUndoMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const settings = JSON.parse(project.settings || '{}');
      const undo = settings.lastBatchReplaceUndo || settings.lastStoryQaUndo;
      if (!undo || !undo.rows || !undo.rows.length) {
        return errorJson('Không có thao tác nào để hoàn tác!', 400);
      }

      const now = new Date().toISOString();
      for (const row of undo.rows) {
        await db.prepare(`
          UPDATE chapters
          SET translatedText = ?,
              translatedTitle = ?,
              qaReport = ?,
              issues = ?,
              chineseCharCount = ?,
              updatedAt = ?
          WHERE id = ?
        `).bind(
          row.translatedText,
          row.translatedTitle,
          row.qaReport,
          row.issues,
          row.chineseCharCount,
          now,
          row.id
        ).run();
      }

      delete settings.lastBatchReplaceUndo;
      delete settings.lastStoryQaUndo;
      await db.prepare("UPDATE projects SET settings = ? WHERE id = ?").bind(JSON.stringify(settings), projectId).run();

      return json({
        success: true,
        message: `Đã hoàn tác thành công cho ${undo.rows.length} chương!`,
        restoredCount: undo.rows.length
      });
    }

    // Story-wide QA Scan: /api/projects/:id/story-qa
    const storyQaMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/story-qa$/);
    if (storyQaMatch && method === 'GET') {
      const [_, projectId] = storyQaMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const characters = JSON.parse(project.characters || '[]');
      const terms = JSON.parse(project.terms || '[]');
      const pronounMatrix = JSON.parse(project.pronounMatrix || '[]');
      const settings = JSON.parse(project.settings || '{}');

      const { results: chapters } = await db.prepare(
        "SELECT id, chapterIndex, title, translatedTitle, translatedText, qaReport FROM chapters WHERE projectId = ? AND (status = 'completed' OR translatedText IS NOT NULL) ORDER BY chapterIndex ASC"
      ).bind(projectId).all();

      const groupMap = new Map();
      let totalIssues = 0;
      const chapterSummaries = [];

      for (const ch of (chapters || [])) {
        const text = ch.translatedText || '';
        if (!text) continue;
        const qa = auditText(text, '', { characters, terms, pronounMatrix });
        let chIssueCount = 0;

        for (const issue of qa.issues) {
          totalIssues++;
          chIssueCount++;

          const val = issue.targetSnippet || issue.message;
          const key = `${issue.type}:${val}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              key,
              type: issue.type,
              title: issue.title,
              value: val,
              severity: issue.severity,
              instruction: issue.instruction || '',
              replacement: issue.type === 'untranslated_chinese' && SINO_VIET_MAP[val] ? SINO_VIET_MAP[val] : '',
              isSafe: issue.type === 'quotation_balance' || (issue.type === 'untranslated_chinese' && Boolean(SINO_VIET_MAP[val])),
              count: 0,
              chapterIds: new Set(),
              locations: []
            });
          }

          const grp = groupMap.get(key);
          grp.count++;
          grp.chapterIds.add(ch.id);
          if (grp.locations.length < 5) {
            grp.locations.push({
              chapterId: ch.id,
              chapterIndex: ch.chapterIndex,
              chapterTitle: ch.translatedTitle || ch.title,
              snippet: val
            });
          }
        }

        if (chIssueCount > 0) {
          chapterSummaries.push({
            id: ch.id,
            chapterIndex: ch.chapterIndex,
            title: ch.translatedTitle || ch.title,
            issueCount: chIssueCount
          });
        }
      }

      const groups = Array.from(groupMap.values()).map(g => ({
        ...g,
        chapterCount: g.chapterIds.size,
        chapterIds: Array.from(g.chapterIds)
      })).sort((a, b) => b.count - a.count);

      const canUndo = Boolean(settings.lastBatchReplaceUndo || settings.lastStoryQaUndo);

      return json({
        success: true,
        totalChapters: (chapters || []).length,
        totalIssues,
        groups,
        chapterSummaries,
        canUndo
      });
    }

    // Story QA Apply All Safe: /api/projects/:id/story-qa/apply-all-safe
    const storyQaSafeMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/story-qa\/apply-all-safe$/);
    if (storyQaSafeMatch && method === 'POST') {
      const [_, projectId] = storyQaSafeMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return errorJson('Không tìm thấy dự án', 404);

      const characters = JSON.parse(project.characters || '[]');
      const terms = JSON.parse(project.terms || '[]');
      const pronounMatrix = JSON.parse(project.pronounMatrix || '[]');
      const settings = JSON.parse(project.settings || '{}');

      const { results: chapters } = await db.prepare(
        "SELECT id, chapterIndex, title, originalText, translatedTitle, translatedText, qaReport, issues, chineseCharCount FROM chapters WHERE projectId = ? AND (status = 'completed' OR translatedText IS NOT NULL) ORDER BY chapterIndex ASC"
      ).bind(projectId).all();

      // Save undo snapshot
      settings.lastStoryQaUndo = {
        timestamp: new Date().toISOString(),
        rows: (chapters || []).map(ch => ({
          id: ch.id,
          translatedText: ch.translatedText,
          translatedTitle: ch.translatedTitle,
          qaReport: ch.qaReport,
          issues: ch.issues,
          chineseCharCount: ch.chineseCharCount
        }))
      };

      await db.prepare("UPDATE projects SET settings = ? WHERE id = ?").bind(JSON.stringify(settings), projectId).run();

      let fixedCount = 0;
      const now = new Date().toISOString();

      for (const ch of (chapters || [])) {
        if (!ch.translatedText) continue;
        const cleanedText = autoFixContent(ch.translatedText);
        const cleanedTitle = autoFixContent(ch.translatedTitle || ch.title);

        const qa = auditText(cleanedText, ch.originalText, { characters, terms, pronounMatrix });

        await db.prepare(`
          UPDATE chapters
          SET translatedText = ?,
              translatedTitle = ?,
              qaReport = ?,
              issues = ?,
              chineseCharCount = ?,
              updatedAt = ?
          WHERE id = ?
        `).bind(
          cleanedText,
          cleanedTitle,
          JSON.stringify(qa),
          JSON.stringify(qa.issues.map(i => i.message)),
          qa.stats.chineseCharCount,
          now,
          ch.id
        ).run();

        fixedCount++;
      }

      return json({
        success: true,
        message: `Đã áp dụng sửa chữa an toàn thành công cho ${fixedCount} chương!`,
        fixedChaptersCount: fixedCount,
        canUndo: true
      });
    }

    // Quick Translate
    if (pathname === '/api/quick-translate' && method === 'POST') {
      const body = await request.json();
      const keys = await getApiKeys(db, env);
      const result = await callGemini(keys, body.model || 'gemini-3.6-flash', `Dịch sang tiếng Việt tự nhiên:\n\n${body.text}`);
      return json({ translatedText: result });
    }

    // Queue status dummy (for cloud edge)
    const queueStatusMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/queue\/status$/);
    if (queueStatusMatch && method === 'GET') {
      return json({ isRunning: false, activeChapterId: null, queueLength: 0 });
    }

    return errorJson(`Không tìm thấy endpoint ${method} ${pathname}`, 404);

  } catch (err) {
    console.error(`Edge API Error:`, err);
    return errorJson(err.message || 'Lỗi xử lý Cloudflare', 500);
  }
}
