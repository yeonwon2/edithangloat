// Express API Routes for DichTruyenPro

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const Store = require('../services/store');
const { geminiPool } = require('../services/geminiPool');
const TextSplitter = require('../services/textSplitter');
const GlossaryEngine = require('../services/glossaryEngine');
const Translator = require('../services/translator');
const batchQueue = require('../services/batchQueue');
const ExportService = require('../services/exportService');
const FileParser = require('../services/fileParser');
const PostProcessor = require('../services/postProcessor');

// Multer memory storage for uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// Initialize keys from store
const initialConfig = Store.getConfig();
if (initialConfig.apiKeys && initialConfig.apiKeys.length > 0) {
  geminiPool.setKeys(initialConfig.apiKeys);
}

// ==========================================
// 0. Authentication & Password Management
// ==========================================
router.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const config = Store.getConfig();
  const currentPass = (config.adminPassword || 'lilyhub888').trim();
  if ((password || '').trim() !== currentPass) {
    return res.status(401).json({ success: false, message: 'Mật khẩu truy cập không chính xác!' });
  }
  const token = `token_${Date.now()}_${uuidv4().replace(/-/g, '')}`;
  res.json({ success: true, token, message: 'Đăng nhập thành công!' });
});

router.get('/auth/check', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ authenticated: false, message: 'Chưa đăng nhập' });
});

router.post('/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
  }
  const config = Store.getConfig();
  const currentPass = (config.adminPassword || 'lilyhub888').trim();
  if ((currentPassword || '').trim() !== currentPass) {
    return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng!' });
  }
  config.adminPassword = newPassword.trim();
  Store.saveConfig(config);
  res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
});

// ==========================================
// 1. API Keys Management
// ==========================================
router.get('/keys', (req, res) => {
  res.json({ keys: geminiPool.getKeys() });
});

router.post('/keys', (req, res) => {
  const { keys } = req.body;
  geminiPool.setKeys(keys);
  // Persist
  const config = Store.getConfig();
  config.apiKeys = Array.isArray(keys) ? keys : [keys];
  Store.saveConfig(config);
  res.json({ success: true, keys: geminiPool.getKeys() });
});

router.post('/keys/test', async (req, res) => {
  const { key, model } = req.body;
  const testKeyStr = key || (geminiPool.keys[0] ? geminiPool.keys[0].key : null);
  if (!testKeyStr) {
    return res.status(400).json({ success: false, message: 'Chưa có API key để kiểm tra.' });
  }
  const result = await geminiPool.testKey(testKeyStr, model || 'gemini-2.0-flash');
  res.json(result);
});

router.post('/keys/reset', (req, res) => {
  geminiPool.resetAllKeysStatus();
  res.json({ success: true, keys: geminiPool.getKeys() });
});

router.get('/models', async (req, res) => {
  const models = await geminiPool.fetchAvailableModels();
  res.json({ models });
});

// ==========================================
// Quick Direct Translation (Dán văn bản trực tiếp không cần tạo project)
// ==========================================
router.post('/quick-translate', async (req, res) => {
  const { text, title, genre, toneGuidance, model, characters, pronounMatrix, terms } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Vui lòng dán nội dung văn bản cần dịch.' });
  }

  try {
    const glossary = new GlossaryEngine();
    glossary.setData({
      characters: characters || [],
      pronounMatrix: pronounMatrix || [],
      terms: terms || []
    });
    const glossaryContext = glossary.buildContextForTranslation(text);

    const result = await Translator.translateChapter({
      rawTitle: title || 'Đoạn Văn Dán Trực Tiếp',
      rawText: text,
      genre: genre || 'Tiên Hiệp',
      toneGuidance: toneGuidance || 'Văn phong hào sảng, cổ phong, xưng hô tôn ti rõ ràng',
      glossaryContext,
      terms: terms || [],
      model: model || 'gemini-2.5-flash'
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Quick Proofread & Pronoun Correction (Biên tập & sửa chuẩn xưng hô tiếng Việt)
// ==========================================
router.post('/quick-proofread', async (req, res) => {
  const { text, genre, toneGuidance, model, characters, pronounMatrix, terms } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Vui lòng dán văn bản tiếng Việt cần biên tập.' });
  }

  try {
    const glossary = new GlossaryEngine();
    glossary.setData({
      characters: characters || [],
      pronounMatrix: pronounMatrix || [],
      terms: terms || []
    });
    const glossaryContext = glossary.buildContextForTranslation(text);

    const result = await Translator.proofreadVietnamese({
      vietnameseText: text,
      genre: genre || 'Đô Thị / Bách Hợp / Ngôn Tình',
      toneGuidance: toneGuidance || 'Văn phong mượt mà, cảm xúc, xưng hô chuẩn xác',
      glossaryContext,
      terms: terms || [],
      model: model || 'gemini-3.5-flash-lite'
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 2. Projects Management
// ==========================================
router.get('/projects', (req, res) => {
  const projects = Store.getProjects();
  // Return summary without heavy chapter bodies for list view
  const summaries = projects.map(p => ({
    id: p.id,
    title: p.title,
    genre: p.genre,
    totalChapters: p.chapters ? p.chapters.length : 0,
    completedChapters: p.chapters ? p.chapters.filter(c => c.status === 'completed').length : 0,
    characterCount: p.characters ? p.characters.length : 0,
    updatedAt: p.updatedAt
  }));
  res.json({ projects: summaries });
});

router.post('/projects', (req, res) => {
  const { title, genre, toneGuidance, model } = req.body;
  const newProject = {
    id: uuidv4(),
    title: title || 'Tiểu Thuyết Mới',
    genre: genre || 'Tiên Hiệp',
    toneGuidance: toneGuidance || 'Văn phong hào sảng, cổ phong, xưng hô tôn ti rõ ràng',
    model: model || 'gemini-2.5-flash',
    characters: [],
    pronounMatrix: [],
    terms: [],
    chapters: []
  };
  Store.saveProject(newProject);
  res.json({ success: true, project: newProject });
});

router.get('/projects/:id', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });
  res.json({ project });
});

router.put('/projects/:id', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const updated = { ...project, ...req.body };
  Store.saveProject(updated);
  res.json({ success: true, project: updated });
});

router.delete('/projects/:id', (req, res) => {
  Store.deleteProject(req.params.id);
  res.json({ success: true });
});

// ==========================================
// 3. Chapters & Text Processing
// ==========================================
router.post('/projects/:id/import-text', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const { text, singleChapter, customTitle } = req.body;
  if (!text) return res.status(400).json({ error: 'Không có nội dung văn bản' });

  const splitChapters = TextSplitter.splitIntoChapters(text, {
    singleChapter: Boolean(singleChapter),
    customTitle
  });
  const startIndex = project.chapters ? project.chapters.length : 0;

  const newChapters = splitChapters.map((ch, i) => ({
    id: uuidv4(),
    index: startIndex + i + 1,
    title: ch.title,
    originalText: ch.originalText,
    translatedTitle: '',
    translatedText: '',
    status: 'pending',
    wordCount: ch.wordCount,
    issues: []
  }));

  project.chapters = [...(project.chapters || []), ...newChapters];
  Store.saveProject(project);

  res.json({ success: true, count: newChapters.length, chapters: newChapters });
});

router.post('/projects/:id/upload', upload.single('file'), async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file (.txt, .docx, .epub, .pdf, .zip)' });

  try {
    const text = await FileParser.extractText(req.file.buffer, req.file.originalname);
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'File trống hoặc không thể trích xuất văn bản.' });
    }

    const isSingle = req.body.singleChapter === 'true';
    const splitChapters = TextSplitter.splitIntoChapters(text, { singleChapter: isSingle });
    const startIndex = project.chapters ? project.chapters.length : 0;

    const newChapters = splitChapters.map((ch, i) => ({
      id: uuidv4(),
      index: startIndex + i + 1,
      title: ch.title,
      originalText: ch.originalText,
      translatedTitle: '',
      translatedText: '',
      status: 'pending',
      wordCount: ch.wordCount,
      issues: []
    }));

    project.chapters = [...(project.chapters || []), ...newChapters];
    Store.saveProject(project);

    res.json({ success: true, count: newChapters.length, chapters: newChapters });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi trích xuất file: ' + err.message });
  }
});

router.put('/projects/:id/chapters/:chapterId', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chIdx = project.chapters.findIndex(c => c.id === req.params.chapterId);
  if (chIdx === -1) return res.status(404).json({ error: 'Không tìm thấy chương' });

  project.chapters[chIdx] = { ...project.chapters[chIdx], ...req.body };
  Store.saveProject(project);

  res.json({ success: true, chapter: project.chapters[chIdx] });
});

router.delete('/projects/:id/chapters/:chapterId', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  project.chapters = project.chapters.filter(c => c.id !== req.params.chapterId);
  Store.saveProject(project);

  res.json({ success: true });
});

// ==========================================
// 4. Glossary & AI Auto-Scan
// ==========================================
router.post('/projects/:id/auto-scan', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  // Collect sample text from first 2 chapters or provided text
  let sample = req.body.sampleText || '';
  if (!sample && project.chapters && project.chapters.length > 0) {
    sample = project.chapters.slice(0, 3).map(c => `${c.title}\n${c.originalText}`).join('\n\n');
  }

  if (!sample) {
    return res.status(400).json({ error: 'Chưa có văn bản chương nào để AI quét.' });
  }

  try {
    const scanPrompt = GlossaryEngine.getScanPrompt(sample, project.genre);
    const responseText = await geminiPool.callGeminiWithRetry({
      prompt: scanPrompt,
      model: project.model || 'gemini-2.5-flash',
      temperature: 0.2
    });

    // Extract JSON from response
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Lỗi đọc kết quả JSON từ AI', raw: responseText });
    }

    // Merge into project
    const newChars = (parsed.characters || []).map(c => ({ id: uuidv4(), ...c }));
    const newPronouns = (parsed.pronounMatrix || []).map(p => ({ id: uuidv4(), ...p }));
    const newTerms = (parsed.terms || []).map(t => ({ id: uuidv4(), ...t }));

    project.characters = [...(project.characters || []), ...newChars];
    project.pronounMatrix = [...(project.pronounMatrix || []), ...newPronouns];
    project.terms = [...(project.terms || []), ...newTerms];

    Store.saveProject(project);

    res.json({
      success: true,
      added: {
        characters: newChars.length,
        pronounMatrix: newPronouns.length,
        terms: newTerms.length
      },
      project
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/import-vietphrase', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Nội dung trống' });

  const glossary = new GlossaryEngine();
  glossary.setData({
    characters: project.characters || [],
    pronounMatrix: project.pronounMatrix || [],
    terms: project.terms || []
  });

  const count = glossary.importVietphrase(content);
  project.terms = glossary.terms;
  Store.saveProject(project);

  res.json({ success: true, importedCount: count, terms: project.terms });
});

router.get('/projects/:id/export-vietphrase', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const glossary = new GlossaryEngine();
  glossary.setData({
    characters: project.characters || [],
    pronounMatrix: project.pronounMatrix || [],
    terms: project.terms || []
  });

  const content = glossary.exportVietphrase();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Names_${project.id.slice(0, 8)}.txt"`);
  res.send(content);
});

// ==========================================
// 5. Translation & Queue Operations
// ==========================================
router.post('/projects/:id/translate-chapter/:chapterId', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chIdx = project.chapters.findIndex(c => c.id === req.params.chapterId);
  if (chIdx === -1) return res.status(404).json({ error: 'Không tìm thấy chương' });

  const chapter = project.chapters[chIdx];
  project.chapters[chIdx].status = 'translating';
  Store.saveProject(project);

  try {
    const glossary = new GlossaryEngine();
    glossary.setData({
      characters: project.characters || [],
      pronounMatrix: project.pronounMatrix || [],
      terms: project.terms || []
    });
    const glossaryContext = glossary.buildContextForTranslation(chapter.originalText);

    // Get previous chapter summary if available
    const prevChapter = chIdx > 0 ? project.chapters[chIdx - 1] : null;
    const prevSummary = prevChapter ? prevChapter.summary : '';

    const result = await Translator.translateChapter({
      rawTitle: chapter.title,
      rawText: chapter.originalText,
      genre: project.genre,
      toneGuidance: project.toneGuidance,
      glossaryContext,
      previousSummary: prevSummary,
      terms: project.terms,
      model: project.model,
      strictMode: Boolean(req.body.strictMode)
    });

    project.chapters[chIdx].translatedTitle = result.translatedTitle;
    project.chapters[chIdx].translatedText = result.translatedText;
    project.chapters[chIdx].summary = result.summary;
    project.chapters[chIdx].status = 'completed';
    project.chapters[chIdx].issues = result.issues;
    project.chapters[chIdx].chineseCharCount = result.chineseCharCount;
    project.chapters[chIdx].pronounAudit = result.pronounAudit;
    project.chapters[chIdx].qaReport = result.qaReport;

    // Auto-accumulate newly discovered characters into project
    if (result.newDiscoveredEntities && result.newDiscoveredEntities.length > 0) {
      const existingChars = project.characters || [];
      for (const newC of result.newDiscoveredEntities) {
        if (newC.vi && !existingChars.find(c => c.vi === newC.vi || (newC.zh && c.zh === newC.zh))) {
          existingChars.push({
            id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            zh: newC.zh || '',
            vi: newC.vi,
            gender: newC.gender || 'Chưa rõ',
            role: newC.role || 'Tự động phát hiện',
            notes: `Phát hiện từ ${chapter.title}`
          });
        }
      }
      project.characters = existingChars;
    }

    // Auto-accumulate newly discovered pronoun pairs
    if (result.pronounAudit?.pronounPairs?.length > 0) {
      const existingPairs = project.pronounMatrix || [];
      for (const pair of result.pronounAudit.pronounPairs) {
        if (pair.speaker && pair.listener) {
          const already = existingPairs.find(p =>
            (p.speakerZh === pair.speaker || p.speakerVi === pair.speaker) &&
            (p.listenerZh === pair.listener || p.listenerVi === pair.listener)
          );
          if (!already) {
            existingPairs.push({
              id: `prn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              speakerZh: pair.speaker,
              listenerZh: pair.listener,
              speakerCallsSelf: pair.speakerSelf || 'ta',
              speakerCallsListener: pair.speakerCallsOther || 'ngươi',
              notes: pair.tone || 'Tự động trích xuất'
            });
          }
        }
      }
      project.pronounMatrix = existingPairs;
    }

    Store.saveProject(project);

    res.json({ success: true, chapter: project.chapters[chIdx], project });
  } catch (err) {
    project.chapters[chIdx].status = 'error';
    project.chapters[chIdx].error = err.message;
    Store.saveProject(project);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to proofread and standardize pronouns of an existing chapter's translation
router.post('/projects/:id/proofread-chapter/:chapterId', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chIdx = project.chapters.findIndex(c => c.id === req.params.chapterId);
  if (chIdx === -1) return res.status(404).json({ error: 'Không tìm thấy chương' });

  const chapter = project.chapters[chIdx];
  const textToProofread = req.body.text || chapter.translatedText;
  if (!textToProofread || !textToProofread.trim()) {
    return res.status(400).json({ error: 'Chưa có bản dịch tiếng Việt để biên tập.' });
  }

  try {
    const glossary = new GlossaryEngine();
    glossary.setData({
      characters: project.characters || [],
      pronounMatrix: project.pronounMatrix || [],
      terms: project.terms || []
    });
    const glossaryContext = glossary.buildContextForTranslation(chapter.originalText || textToProofread);

    const result = await Translator.proofreadVietnamese({
      vietnameseText: textToProofread,
      genre: project.genre,
      toneGuidance: project.toneGuidance,
      glossaryContext,
      terms: project.terms,
      model: project.model
    });

    project.chapters[chIdx].translatedText = result.translatedText;
    project.chapters[chIdx].status = 'completed';
    project.chapters[chIdx].issues = result.issues;
    project.chapters[chIdx].chineseCharCount = result.chineseCharCount;
    Store.saveProject(project);

    res.json({ success: true, chapter: project.chapters[chIdx], project });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi biên tập: ' + err.message });
  }
});

// Endpoint: 1-Click Instant Auto-Fix
router.post('/projects/:id/auto-fix-chapter/:chapterId', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chIdx = project.chapters.findIndex(c => c.id === req.params.chapterId);
  if (chIdx === -1) return res.status(404).json({ error: 'Không tìm thấy chương' });

  const chapter = project.chapters[chIdx];
  const input = req.body.text || chapter.translatedText;
  if (!input) return res.status(400).json({ error: 'Chưa có văn bản để sửa' });

  const fixedText = PostProcessor.autoFix(input, project.terms || []);
  const qaReport = PostProcessor.audit(fixedText, chapter.originalText, {
    characters: project.characters || [],
    pronounMatrix: project.pronounMatrix || [],
    terms: project.terms || []
  });

  project.chapters[chIdx].translatedText = fixedText;
  project.chapters[chIdx].qaReport = qaReport;
  project.chapters[chIdx].chineseCharCount = qaReport.stats.chineseCharCount;
  project.chapters[chIdx].issues = qaReport.issues.map(i => i.message);
  Store.saveProject(project);

  res.json({ success: true, chapter: project.chapters[chIdx], qaReport });
});

// Endpoint: Audit Chapter Quality
router.post('/projects/:id/audit-chapter/:chapterId', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chapter = project.chapters.find(c => c.id === req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: 'Không tìm thấy chương' });

  const textToAudit = req.body.text || chapter.translatedText;
  const qaReport = PostProcessor.audit(textToAudit, chapter.originalText, {
    characters: project.characters || [],
    pronounMatrix: project.pronounMatrix || [],
    terms: project.terms || []
  });

  res.json({ success: true, qaReport });
});

// Endpoint: Targeted Surgical AI Fix for a specific snippet
router.post('/projects/:id/targeted-fix/:chapterId', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chIdx = project.chapters.findIndex(c => c.id === req.params.chapterId);
  if (chIdx === -1) return res.status(404).json({ error: 'Không tìm thấy chương' });

  const chapter = project.chapters[chIdx];
  const { selectedText, instruction, fullText } = req.body;

  if (!selectedText || !selectedText.trim()) {
    return res.status(400).json({ error: 'Chưa có đoạn văn nào được chọn để sửa.' });
  }

  const currentFullText = fullText || chapter.translatedText || '';

  try {
    const glossary = new GlossaryEngine();
    glossary.setData({
      characters: project.characters || [],
      pronounMatrix: project.pronounMatrix || [],
      terms: project.terms || []
    });
    const glossaryContext = glossary.buildContextForTranslation(selectedText);

    // Calculate surrounding context
    const snippetIdx = currentFullText.indexOf(selectedText);
    let contextSurrounding = '';
    if (snippetIdx !== -1) {
      const start = Math.max(0, snippetIdx - 200);
      const end = Math.min(currentFullText.length, snippetIdx + selectedText.length + 200);
      contextSurrounding = currentFullText.slice(start, end);
    }

    const fixedSnippet = await Translator.targetedFix({
      selectedText,
      instruction: instruction || 'Sửa đúng lỗi, chuẩn hóa xưng hô và mượt câu',
      contextSurrounding,
      genre: project.genre,
      glossaryContext,
      model: project.model
    });

    // Replace the snippet in fullText
    let updatedFullText = currentFullText;
    if (updatedFullText.includes(selectedText)) {
      updatedFullText = updatedFullText.replace(selectedText, fixedSnippet);
    } else {
      updatedFullText = updatedFullText.replace(selectedText.trim(), fixedSnippet);
    }

    // Re-audit with QA Guard
    const qaReport = PostProcessor.audit(updatedFullText, chapter.originalText, {
      characters: project.characters || [],
      pronounMatrix: project.pronounMatrix || [],
      terms: project.terms || []
    });

    project.chapters[chIdx].translatedText = updatedFullText;
    project.chapters[chIdx].qaReport = qaReport;
    project.chapters[chIdx].chineseCharCount = qaReport.stats.chineseCharCount;
    project.chapters[chIdx].issues = qaReport.issues.map(i => i.message);
    Store.saveProject(project);

    res.json({
      success: true,
      fixedSnippet,
      translatedText: updatedFullText,
      chapter: project.chapters[chIdx],
      qaReport
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi AI sửa đoạn văn: ' + err.message });
  }
});

router.post('/projects/:id/queue/start', async (req, res) => {
  try {
    const { chapterIds } = req.body;
    const result = await batchQueue.startQueue(req.params.id, chapterIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/queue/stop', (req, res) => {
  batchQueue.stopJob(req.params.id);
  res.json({ success: true, message: 'Đã gửi lệnh dừng hàng đợi.' });
});

router.get('/projects/:id/queue/status', (req, res) => {
  const status = batchQueue.getJobStatus(req.params.id);
  res.json(status);
});

// ==========================================
// 5.1 QA, Pronoun Consistency & Batch Replace
// ==========================================

const WORD_CHAR = "A-Za-z0-9_\\u00C0-\\u1EFF";

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordRegex(term) {
  const escaped = escapeRegex(term);
  return new RegExp(`(?<![${WORD_CHAR}])(?:${escaped})(?![${WORD_CHAR}])`, "gu");
}

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

function extractPronounAudit(text, characters = [], pronounMatrix = []) {
  if (!text) return { charactersDetected: [], pronounPairs: [] };

  const detectedChars = [];
  for (const c of (characters || [])) {
    const name = c.vi || c.zh;
    if (!name || name.length < 2) continue;
    const escaped = escapeRegex(name);
    const matches = text.match(new RegExp(`\\b${escaped}\\b`, 'gi'));
    if (matches && matches.length > 0) {
      detectedChars.push({ name, count: matches.length, gender: c.gender || 'Chưa rõ', role: c.role || '' });
    }
  }

  const pairs = [];
  const addedKeys = new Set();

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

  return { charactersDetected: detectedChars, pronounPairs: pairs };
}

// 1. Cross-chapter Pronoun Consistency
router.get('/projects/:id/pronoun-consistency', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const characters = project.characters || [];
  const pronounMatrix = project.pronounMatrix || [];
  const chapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);

  const inconsistencies = [];
  const crossChapterPairsMap = new Map();
  let totalPairsChecked = 0;

  for (const ch of chapters) {
    const text = ch.translatedText || '';
    if (!text.trim()) continue;

    const audit = extractPronounAudit(text, characters, pronounMatrix);

    const quotes = text.match(/[“"][^”"\n]{3,150}[”"]/g) || [];
    for (const q of quotes) {
      if (/(?:Hoàng thượng|Bệ hạ|nương nương|Hoàng hậu)/i.test(q) && /\btôi\b/i.test(q)) {
        inconsistencies.push({
          chapterId: ch.id,
          chapterIndex: ch.index,
          chapterTitle: ch.translatedTitle || ch.title,
          severity: 'warning',
          issue: 'Xưng hô hiện đại "tôi" trước mặt Hoàng thượng / Nương nương',
          snippet: q.slice(0, 100),
          suggestedFix: 'Đổi thành "thảo dân" hoặc "dân nữ"'
        });
      }
    }

    for (const p of audit.pronounPairs) {
      totalPairsChecked++;
      const pairKey = `${p.speaker} ➔ ${p.listener}`;
      if (!crossChapterPairsMap.has(pairKey)) {
        crossChapterPairsMap.set(pairKey, {
          speaker: p.speaker,
          listener: p.listener,
          speakerSelf: p.speakerCallsSelf,
          speakerCallsOther: p.speakerCallsOther,
          chapters: [ch.index],
          isConsistent: p.status !== 'inconsistent'
        });
      } else {
        const entry = crossChapterPairsMap.get(pairKey);
        if (!entry.chapters.includes(ch.index)) {
          entry.chapters.push(ch.index);
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

  res.json({
    success: true,
    overallConsistency: consistencyRate,
    totalChaptersAudited: chapters.length,
    totalPairsAudited: totalPairsChecked,
    crossChapterMatrix,
    inconsistencies,
    matrixRulesCount: pronounMatrix.length,
    charactersCount: characters.length
  });
});

// 2. Batch Auto-Fix Pronouns & Hanzi
router.post('/projects/:id/batch-fix-pronouns', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  let fixedCount = 0;
  let totalHanziCleaned = 0;

  for (let i = 0; i < (project.chapters || []).length; i++) {
    const ch = project.chapters[i];
    if (!ch.translatedText) continue;

    const origText = ch.translatedText;
    const cleanedText = PostProcessor.autoFix(ch.translatedText, project.terms || []);
    const cleanedTitle = PostProcessor.autoFix(ch.translatedTitle || ch.title, project.terms || []);

    const hanBefore = (origText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const hanAfter = (cleanedText.match(/[\u4e00-\u9fa5]/g) || []).length;
    totalHanziCleaned += Math.max(0, hanBefore - hanAfter);

    const qa = PostProcessor.audit(cleanedText, ch.originalText, {
      characters: project.characters || [],
      terms: project.terms || [],
      pronounMatrix: project.pronounMatrix || []
    });

    ch.translatedText = cleanedText;
    ch.translatedTitle = cleanedTitle;
    ch.qaReport = qa;
    ch.issues = qa.issues.map(it => it.message);
    ch.chineseCharCount = qa.stats.chineseCharCount;

    fixedCount++;
  }

  Store.saveProject(project);

  res.json({
    success: true,
    message: `Đã chuẩn hóa và làm sạch thành công ${fixedCount} chương! Đã triệt tiêu ${totalHanziCleaned} chữ Hán tồn đọng.`,
    fixedChaptersCount: fixedCount,
    totalHanziCleaned
  });
});

// 3. Batch Replace Preview
router.post('/projects/:id/batch-replace/preview', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const { rules = [], scope = 'story', chapterId = null, wholeWord = false } = req.body;
  const validRules = (rules || []).filter(r => String(r.find || '').trim().length > 0);
  if (!validRules.length) return res.json({ success: true, totalMatches: 0, chapterCount: 0, chapterMatches: [] });

  let targetChapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);
  if (scope === 'chapter' && chapterId) {
    targetChapters = targetChapters.filter(c => c.id === chapterId);
  }

  let totalMatches = 0;
  const chapterMatches = [];

  for (const ch of targetChapters) {
    const text = ch.translatedText || '';
    if (!text) continue;
    const prev = previewReplacements(text, validRules, wholeWord);
    if (prev.count > 0) {
      totalMatches += prev.count;
      chapterMatches.push({
        chapterId: ch.id,
        chapterIndex: ch.index,
        title: ch.translatedTitle || ch.title,
        count: prev.count,
        samples: prev.samples
      });
    }
  }

  res.json({
    success: true,
    totalMatches,
    chapterCount: chapterMatches.length,
    chapterMatches
  });
});

// 4. Batch Replace Apply
router.post('/projects/:id/batch-replace/apply', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const { rules = [], scope = 'story', chapterId = null, wholeWord = false } = req.body;
  const validRules = (rules || []).filter(r => String(r.find || '').trim().length > 0);
  if (!validRules.length) return res.status(400).json({ error: 'Không có quy tắc thay thế hợp lệ' });

  let targetChapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);
  if (scope === 'chapter' && chapterId) {
    targetChapters = targetChapters.filter(c => c.id === chapterId);
  }

  project.settings = project.settings || {};
  project.settings.lastBatchReplaceUndo = {
    timestamp: new Date().toISOString(),
    scope,
    rules: validRules,
    rows: targetChapters.map(ch => ({
      id: ch.id,
      translatedText: ch.translatedText,
      translatedTitle: ch.translatedTitle,
      qaReport: ch.qaReport,
      issues: ch.issues,
      chineseCharCount: ch.chineseCharCount
    }))
  };

  let totalReplaced = 0;
  let chaptersUpdated = 0;

  for (const ch of targetChapters) {
    const origText = ch.translatedText || '';
    const rep = applyReplacements(origText, validRules, wholeWord);
    if (rep.count > 0) {
      totalReplaced += rep.count;
      chaptersUpdated++;

      const cleanedText = PostProcessor.autoFix(rep.text, project.terms || []);
      const qa = PostProcessor.audit(cleanedText, ch.originalText, {
        characters: project.characters || [],
        terms: project.terms || [],
        pronounMatrix: project.pronounMatrix || []
      });

      ch.translatedText = cleanedText;
      ch.qaReport = qa;
      ch.issues = qa.issues.map(i => i.message);
      ch.chineseCharCount = qa.stats.chineseCharCount;
    }
  }

  Store.saveProject(project);

  res.json({
    success: true,
    message: `Đã thay thế thành công ${totalReplaced} vị trí trong ${chaptersUpdated} chương!`,
    totalReplaced,
    chaptersUpdated,
    canUndo: true
  });
});

// 5. Batch Replace / QA Undo
router.post('/projects/:id/batch-replace/undo', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const settings = project.settings || {};
  const undo = settings.lastBatchReplaceUndo || settings.lastStoryQaUndo;
  if (!undo || !undo.rows || !undo.rows.length) {
    return res.status(400).json({ error: 'Không có thao tác nào để hoàn tác!' });
  }

  for (const row of undo.rows) {
    const ch = (project.chapters || []).find(c => c.id === row.id);
    if (ch) {
      ch.translatedText = row.translatedText;
      ch.translatedTitle = row.translatedTitle;
      ch.qaReport = row.qaReport;
      ch.issues = row.issues;
      ch.chineseCharCount = row.chineseCharCount;
    }
  }

  delete settings.lastBatchReplaceUndo;
  delete settings.lastStoryQaUndo;
  project.settings = settings;
  Store.saveProject(project);

  res.json({
    success: true,
    message: `Đã hoàn tác thành công cho ${undo.rows.length} chương!`,
    restoredCount: undo.rows.length
  });
});

// 6. Story-wide QA Scan
router.get('/projects/:id/story-qa', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const characters = project.characters || [];
  const terms = project.terms || [];
  const pronounMatrix = project.pronounMatrix || [];
  const settings = project.settings || {};
  const chapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);

  const groupMap = new Map();
  let totalIssues = 0;
  const chapterSummaries = [];

  for (const ch of chapters) {
    const text = ch.translatedText || '';
    if (!text) continue;
    const qa = PostProcessor.audit(text, ch.originalText || '', { characters, terms, pronounMatrix });
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
          title: issue.message ? (issue.type === 'chinese' ? 'Sót chữ Hán' : (issue.type === 'pronoun' ? 'Lệch xưng hô' : (issue.type === 'convert' ? 'Lỗi convert' : issue.type))) : issue.type,
          value: val,
          severity: issue.severity,
          instruction: issue.instruction || '',
          replacement: '',
          isSafe: issue.type === 'ai_meta' || issue.type === 'convert' || issue.type === 'loop' || issue.type === 'spacing',
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
          chapterIndex: ch.index,
          chapterTitle: ch.translatedTitle || ch.title,
          snippet: val
        });
      }
    }

    if (chIssueCount > 0) {
      chapterSummaries.push({
        id: ch.id,
        chapterIndex: ch.index,
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

  res.json({
    success: true,
    totalChapters: chapters.length,
    totalIssues,
    groups,
    chapterSummaries,
    canUndo
  });
});

// 7. Story QA Apply All Safe
router.post('/projects/:id/story-qa/apply-all-safe', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const characters = project.characters || [];
  const terms = project.terms || [];
  const pronounMatrix = project.pronounMatrix || [];
  const settings = project.settings || {};
  const chapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);

  // Save undo snapshot
  settings.lastStoryQaUndo = {
    timestamp: new Date().toISOString(),
    rows: chapters.map(ch => ({
      id: ch.id,
      translatedText: ch.translatedText,
      translatedTitle: ch.translatedTitle,
      qaReport: ch.qaReport,
      issues: ch.issues,
      chineseCharCount: ch.chineseCharCount
    }))
  };
  project.settings = settings;

  let fixedCount = 0;

  for (const ch of chapters) {
    if (!ch.translatedText) continue;
    const cleanedText = PostProcessor.autoFix(ch.translatedText, terms);
    const cleanedTitle = PostProcessor.autoFix(ch.translatedTitle || ch.title, terms);

    const qa = PostProcessor.audit(cleanedText, ch.originalText || '', { characters, terms, pronounMatrix });

    ch.translatedText = cleanedText;
    ch.translatedTitle = cleanedTitle;
    ch.qaReport = qa;
    ch.issues = qa.issues.map(i => i.message);
    ch.chineseCharCount = qa.stats.chineseCharCount;

    fixedCount++;
  }

  Store.saveProject(project);

  res.json({
    success: true,
    message: `Đã áp dụng sửa chữa an toàn thành công cho ${fixedCount} chương!`,
    fixedChaptersCount: fixedCount,
    canUndo: true
  });
});

// ==========================================
// 6. Export Services (TXT, ZIP, DOCX, EPUB)
// ==========================================
router.get('/projects/:id/export/txt', (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chapters = (project.chapters || []).filter(c => c.translatedText || c.status === 'completed');
  if (chapters.length === 0) return res.status(400).json({ error: 'Chưa có chương nào được dịch.' });

  const buffer = ExportService.exportMergedTxt(project.title, chapters);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.title)}.txt"`);
  res.send(buffer);
});

router.get('/projects/:id/export/zip', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chapters = (project.chapters || []).filter(c => c.translatedText || c.status === 'completed');
  if (chapters.length === 0) return res.status(400).json({ error: 'Chưa có chương nào được dịch.' });

  try {
    const buffer = await ExportService.exportZip(project.title, chapters);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.title)}_chapters.zip"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/export/docx', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chapters = (project.chapters || []).filter(c => c.translatedText || c.status === 'completed');
  if (chapters.length === 0) return res.status(400).json({ error: 'Chưa có chương nào được dịch.' });

  try {
    const buffer = await ExportService.exportDocx(project.title, chapters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.title)}.docx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/export/epub', async (req, res) => {
  const project = Store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const chapters = (project.chapters || []).filter(c => c.translatedText || c.status === 'completed');
  if (chapters.length === 0) return res.status(400).json({ error: 'Chưa có chương nào được dịch.' });

  try {
    const buffer = await ExportService.exportEpub(project.title, chapters);
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.title)}.epub"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
