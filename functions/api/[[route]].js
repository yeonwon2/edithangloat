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

// 7-Pillar QA Audit Engine (matching PostProcessor.audit)
function auditText(text, originalText = '', glossary = {}) {
  const issues = [];
  const chars = glossary.characters || [];
  const terms = glossary.terms || [];

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

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  let overallStatus = 'clean';
  if (criticalCount > 0) overallStatus = 'critical';
  else if (warningCount > 0) overallStatus = 'warning';

  return {
    status: overallStatus,
    summary: criticalCount > 0 ? `Phát hiện ${criticalCount} lỗi nghiêm trọng!` : warningCount > 0 ? `Có ${warningCount} cảnh báo cần lưu ý.` : 'Bản dịch đạt chuẩn xuất bản!',
    issues,
    stats: {
      totalIssues: issues.length,
      criticalCount,
      warningCount,
      chineseCharCount: hanChars.length
    }
  };
}

// 1-Click Auto-Fix helper
function autoFixContent(text) {
  if (!text) return text;
  let fixed = text;

  // Clean meta AI chatter
  fixed = fixed.replace(/^.*?(?:đây là bản dịch|dưới đây là bản dịch|bản dịch tiếng việt).*?:\s*\n+/gim, '');
  fixed = fixed.replace(/\n+.*?(?:hy vọng bản dịch làm bạn hài lòng|nếu cần chỉnh sửa gì thêm).*$/gim, '');

  // Balance unpaired quotes
  const opens = (fixed.match(/“/g) || []).length;
  const closes = (fixed.match(/”/g) || []).length;
  if (opens > closes) {
    fixed += '”'.repeat(opens - closes);
  }

  // Smooth common convert artifacts
  fixed = fixed.replace(/\bđích\b/g, '');
  fixed = fixed.replace(/\s{2,}/g, ' ');

  return fixed.trim();
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
          model TEXT DEFAULT 'gemini-2.0-flash',
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
        keys = JSON.parse(row.value);
      }
    } catch (e) {}
  }
  if ((!keys || keys.length === 0) && env && env.GEMINI_API_KEY) {
    keys = env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
  }
  return keys || [];
}

// Helper: Call Gemini with Auto-rotation
async function callGemini(keys, model, prompt, systemInstruction = '') {
  if (!keys || keys.length === 0) {
    throw new Error('Chưa có Gemini API Key nào được cài đặt. Hãy vào "Quản lý API Key" để thêm key.');
  }

  const targetModel = model || 'gemini-2.0-flash';
  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const rawK = keys[i];
    const keyStr = typeof rawK === 'object' ? rawK.key : rawK;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${keyStr}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.95
        }
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
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
          console.warn(`Key ...${keyStr.slice(-4)} exhausted. Rotating next key...`);
          lastError = new Error(`Key ...${keyStr.slice(-4)} hết hạn mức (429).`);
          continue;
        }
        throw new Error(errMsg);
      }

      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content?.parts?.[0]?.text) {
        throw new Error('Gemini không trả về văn bản.');
      }

      return candidate.content.parts[0].text;
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
    // API KEYS
    // ----------------------------------------------------
    if (pathname === '/api/keys') {
      if (method === 'GET') {
        const keys = await getApiKeys(db, env);
        return json({ keys: keys.map(k => ({ key: k, status: 'active' })) });
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
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Khuyên dùng - Nhanh & Mượt)' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Chất lượng dịch cao cấp)' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
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

        return json(formatted);
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
          body.model || 'gemini-2.0-flash',
          JSON.stringify(body.characters || []),
          JSON.stringify(body.terms || []),
          JSON.stringify(body.pronounMatrix || []),
          JSON.stringify(body.settings || {}),
          now,
          now
        ).run();

        const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
        return json({
          ...project,
          characters: JSON.parse(project.characters || '[]'),
          terms: JSON.parse(project.terms || '[]'),
          pronounMatrix: JSON.parse(project.pronounMatrix || '[]'),
          settings: JSON.parse(project.settings || '{}'),
          chapters: []
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

        return json({
          ...project,
          characters: JSON.parse(project.characters || '[]'),
          terms: JSON.parse(project.terms || '[]'),
          pronounMatrix: JSON.parse(project.pronounMatrix || '[]'),
          settings: JSON.parse(project.settings || '{}'),
          chapters: (chapters || []).map(c => ({
            ...c,
            qaReport: JSON.parse(c.qaReport || '{}'),
            issues: JSON.parse(c.issues || '[]')
          }))
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

        return json({ success: true });
      }

      if (method === 'DELETE') {
        await db.batch([
          db.prepare("DELETE FROM chapters WHERE projectId = ?").bind(projectId),
          db.prepare("DELETE FROM projects WHERE id = ?").bind(projectId)
        ]);
        return json({ success: true });
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

      const chapterRegex = /(?:^|\n)(第[\d一二三四五六七八九十百千万]+[章回节]|Chapter\s*\d+|Chương\s*\d+|===[^\n]+===)(.*?)(?=(?:^|\n)(?:第[\d一二三四五六七八九十百千万]+[章回节]|Chapter\s*\d+|Chương\s*\d+|===[^\n]+===)|$)/gis;
      let matches = [];
      let match;
      while ((match = chapterRegex.exec(rawText)) !== null) {
        matches.push({ title: match[1].trim(), content: match[2].trim() });
      }

      if (matches.length === 0 && rawText.trim()) {
        matches.push({ title: 'Chương 1', content: rawText.trim() });
      }

      const now = new Date().toISOString();
      const countRow = await db.prepare("SELECT COUNT(*) as count FROM chapters WHERE projectId = ?").bind(projectId).first();
      const startIndex = countRow ? Number(countRow.count || 0) : 0;

      const stmts = matches.map((m, idx) => {
        const chId = crypto.randomUUID();
        return db.prepare(`
          INSERT INTO chapters (id, projectId, title, chapterIndex, originalText, status, qaReport, issues, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'pending', '{}', '[]', ?, ?)
        `).bind(chId, projectId, m.title, startIndex + idx, m.content, now, now);
      });

      await db.batch(stmts);
      return json({ success: true, count: matches.length });
    }

    // Translate chapter: /api/projects/:id/translate-chapter/:chapterId
    const transMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/translate-chapter\/([^\/]+)$/);
    if (transMatch && method === 'POST') {
      const [_, projectId, chapterId] = transMatch;
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      const chapter = await db.prepare("SELECT * FROM chapters WHERE id = ? AND projectId = ?").bind(chapterId, projectId).first();

      if (!project || !chapter) return errorJson('Không tìm thấy dự án hoặc chương', 404);

      const keys = await getApiKeys(db, env);
      const characters = JSON.parse(project.characters || '[]');
      const terms = JSON.parse(project.terms || '[]');
      const pronounMatrix = JSON.parse(project.pronounMatrix || '[]');

      let sysPrompt = `Bạn là dịch giả tiểu thuyết chuyên nghiệp dịch từ tiếng Trung sang tiếng Việt.\n`;
      if (project.toneGuidance) sysPrompt += `\nĐẶC TẢ VĂN PHONG:\n${project.toneGuidance}\n`;

      if (characters.length > 0) {
        sysPrompt += `\nNHÂN VẬT & NGÔI DẪN CHUYỆN BẮT BUỘC:\n`;
        characters.forEach(c => {
          sysPrompt += `- ${c.zh} → ${c.vi} (Giới tính: ${c.gender || 'Chưa rõ'}). Ngôi dẫn truyện luôn xưng: "${c.narrativePronoun || 'hắn'}". ${c.notes || ''}\n`;
        });
      }

      if (terms.length > 0) {
        sysPrompt += `\nTHUẬT NGỮ / ĐỊA DANH CỐ ĐỊNH:\n`;
        terms.slice(0, 50).forEach(t => {
          sysPrompt += `- ${t.zh} → ${t.vi}\n`;
        });
      }

      sysPrompt += `\nQUY TẮC:\n- Dịch đầy đủ 100%, không tóm tắt hay lược bỏ câu.\n- Giữ nguyên cấu trúc phân đoạn và ngắt dòng của bản gốc.\n- Chỉ xuất ra duy nhất bản dịch tiếng Việt.`;

      const prompt = `Dịch văn bản sau sang tiếng Việt:\n\n${chapter.originalText}`;
      const translated = await callGemini(keys, project.model || 'gemini-2.0-flash', prompt, sysPrompt);

      const qa = auditText(translated, chapter.originalText, { characters, terms, pronounMatrix });
      const now = new Date().toISOString();

      await db.prepare(`
        UPDATE chapters
        SET translatedText = ?,
            translatedTitle = COALESCE(translatedTitle, ?),
            status = 'completed',
            qaReport = ?,
            issues = ?,
            chineseCharCount = ?,
            updatedAt = ?
        WHERE id = ?
      `).bind(
        translated,
        chapter.title,
        JSON.stringify(qa),
        JSON.stringify(qa.issues.map(i => i.message)),
        qa.stats.chineseCharCount,
        now,
        chapterId
      ).run();

      const updatedChap = await db.prepare("SELECT * FROM chapters WHERE id = ?").bind(chapterId).first();
      return json({
        success: true,
        chapter: {
          ...updatedChap,
          qaReport: qa,
          issues: qa.issues.map(i => i.message)
        }
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

      const fixedSnippet = await callGemini(keys, project?.model || 'gemini-2.0-flash', fixPrompt);
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

    // Quick Translate
    if (pathname === '/api/quick-translate' && method === 'POST') {
      const body = await request.json();
      const keys = await getApiKeys(db, env);
      const result = await callGemini(keys, body.model || 'gemini-2.0-flash', `Dịch sang tiếng Việt tự nhiên:\n\n${body.text}`);
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
