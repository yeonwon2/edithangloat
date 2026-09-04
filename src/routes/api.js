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
