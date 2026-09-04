// Batch Translation Queue Manager

const Store = require('./store');
const Translator = require('./translator');
const GlossaryEngine = require('./glossaryEngine');
const { geminiPool } = require('./geminiPool');

class BatchQueue {
  constructor() {
    this.jobs = new Map(); // projectId -> { isRunning: boolean, shouldStop: boolean, currentChapterId: null, completedCount: 0, totalCount: 0, errorCount: 0, logs: [] }
  }

  getJobStatus(projectId) {
    const job = this.jobs.get(projectId);
    if (!job) {
      return { isRunning: false, completedCount: 0, totalCount: 0, errorCount: 0, logs: [] };
    }
    return {
      isRunning: job.isRunning,
      currentChapterId: job.currentChapterId,
      currentChapterTitle: job.currentChapterTitle,
      completedCount: job.completedCount,
      totalCount: job.totalCount,
      errorCount: job.errorCount,
      logs: job.logs.slice(-20)
    };
  }

  stopJob(projectId) {
    const job = this.jobs.get(projectId);
    if (job) {
      job.shouldStop = true;
      job.isRunning = false;
      this.addLog(projectId, 'Hàng đợi dịch đã được tạm dừng.');
    }
  }

  addLog(projectId, message) {
    const job = this.jobs.get(projectId);
    if (job) {
      const time = new Date().toLocaleTimeString();
      job.logs.push(`[${time}] ${message}`);
    }
  }

  async startQueue(projectId, chapterIds = null, concurrency = 1) {
    let job = this.jobs.get(projectId);
    if (job && job.isRunning) {
      return { message: 'Hàng đợi cho dự án này đang chạy.' };
    }

    const project = Store.getProject(projectId);
    if (!project) throw new Error('Không tìm thấy dự án.');

    const targetChapters = chapterIds && chapterIds.length > 0
      ? project.chapters.filter(c => chapterIds.includes(c.id))
      : project.chapters.filter(c => c.status !== 'completed');

    if (targetChapters.length === 0) {
      return { message: 'Không có chương nào cần dịch.' };
    }

    job = {
      isRunning: true,
      shouldStop: false,
      currentChapterId: null,
      currentChapterTitle: '',
      completedCount: 0,
      totalCount: targetChapters.length,
      errorCount: 0,
      logs: []
    };
    this.jobs.set(projectId, job);

    this.addLog(projectId, `Bắt đầu dịch hàng loạt ${targetChapters.length} chương...`);

    // Run sequentially to maintain perfect context continuity & pronoun accuracy
    // (Translating in order allows passing previous chapter's summary)
    (async () => {
      let prevSummary = '';

      for (let i = 0; i < targetChapters.length; i++) {
        if (job.shouldStop) {
          job.isRunning = false;
          break;
        }

        const ch = targetChapters[i];
        job.currentChapterId = ch.id;
        job.currentChapterTitle = ch.title;
        this.addLog(projectId, `Đang dịch [${i + 1}/${targetChapters.length}]: ${ch.title}...`);

        // Update chapter status in project
        let currentProj = Store.getProject(projectId);
        const chIdx = currentProj.chapters.findIndex(c => c.id === ch.id);
        if (chIdx >= 0) {
          currentProj.chapters[chIdx].status = 'translating';
          Store.saveProject(currentProj);
        }

        try {
          // Prepare glossary context
          const glossary = new GlossaryEngine();
          glossary.setData({
            characters: currentProj.characters || [],
            pronounMatrix: currentProj.pronounMatrix || [],
            terms: currentProj.terms || []
          });
          const glossaryContext = glossary.buildContextForTranslation(ch.originalText);

          // Translate
          const result = await Translator.translateChapter({
            rawTitle: ch.title,
            rawText: ch.originalText,
            genre: currentProj.genre || 'Tiên Hiệp',
            toneGuidance: currentProj.toneGuidance || '',
            glossaryContext,
            previousSummary: prevSummary,
            terms: currentProj.terms || [],
            model: currentProj.model || 'gemini-3.5-flash-lite'
          });

          // Save result & Auto-accumulate matrix
          currentProj = Store.getProject(projectId);
          const saveIdx = currentProj.chapters.findIndex(c => c.id === ch.id);
          if (saveIdx >= 0) {
            currentProj.chapters[saveIdx].translatedTitle = result.translatedTitle;
            currentProj.chapters[saveIdx].translatedText = result.translatedText;
            currentProj.chapters[saveIdx].summary = result.summary;
            currentProj.chapters[saveIdx].status = 'completed';
            currentProj.chapters[saveIdx].issues = result.issues;
            currentProj.chapters[saveIdx].chineseCharCount = result.chineseCharCount;
            currentProj.chapters[saveIdx].pronounAudit = result.pronounAudit;

            // Auto-accumulate newly discovered characters into project knowledge base
            if (result.newDiscoveredEntities && result.newDiscoveredEntities.length > 0) {
              const existingChars = currentProj.characters || [];
              for (const newC of result.newDiscoveredEntities) {
                if (newC.vi && !existingChars.find(c => c.vi === newC.vi || (newC.zh && c.zh === newC.zh))) {
                  existingChars.push({
                    id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    zh: newC.zh || '',
                    vi: newC.vi,
                    gender: newC.gender || 'Chưa rõ',
                    role: newC.role || 'Tự động phát hiện',
                    notes: `Phát hiện từ ${ch.title}`
                  });
                }
              }
              currentProj.characters = existingChars;
            }

            // Auto-accumulate newly discovered pronoun pairs
            if (result.pronounAudit?.pronounPairs?.length > 0) {
              const existingPairs = currentProj.pronounMatrix || [];
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
              currentProj.pronounMatrix = existingPairs;
            }

            Store.saveProject(currentProj);
          }

          prevSummary = result.summary;
          job.completedCount++;
          this.addLog(projectId, `✓ Hoàn thành ${ch.title} (${result.issues.length > 0 ? result.issues.join('; ') : 'Hoàn hảo'})`);
        } catch (err) {
          job.errorCount++;
          this.addLog(projectId, `✗ Lỗi dịch ${ch.title}: ${err.message}`);

          currentProj = Store.getProject(projectId);
          const errIdx = currentProj.chapters.findIndex(c => c.id === ch.id);
          if (errIdx >= 0) {
            currentProj.chapters[errIdx].status = 'error';
            currentProj.chapters[errIdx].error = err.message;
            Store.saveProject(currentProj);
          }
        }

        // Brief delay between chapters to ease API rate limits
        await new Promise(r => setTimeout(r, 600));
      }

      job.isRunning = false;
      job.currentChapterId = null;
      this.addLog(projectId, `Hàng đợi kết thúc: ${job.completedCount} hoàn thành, ${job.errorCount} lỗi.`);
    })().catch(err => {
      console.error('Queue fatal error:', err);
      job.isRunning = false;
    });

    return { message: 'Đã khởi động tiến trình dịch thành công!' };
  }
}

const batchQueue = new BatchQueue();
module.exports = batchQueue;
