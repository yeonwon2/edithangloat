import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Copy,
  Maximize2,
  Minimize2,
  Sparkles,
  Columns,
  BookOpen,
  Eye,
  Type,
  Palette,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  Zap,
  MessageSquare,
  X
} from 'lucide-react';

export default function SideBySideEditor({ project, chapter, onBack, onUpdateChapter, onTranslateSingle }) {
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [reTranslating, setReTranslating] = useState(false);
  const [proofreading, setProofreading] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Publishing QA Guard State
  const [qaReport, setQaReport] = useState(null);
  const [showQaDetails, setShowQaDetails] = useState(false);
  const [targetingId, setTargetingId] = useState(null);

  // Surgical Inline Selection AI Fixer State
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const [showInlineAiModal, setShowInlineAiModal] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [inlineFixing, setInlineFixing] = useState(false);

  // View & Reading Preferences
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(18); // 14, 16, 18, 20, 22, 24, 26, 28
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'vi-focus' | 'vi-only' | 'zh-only'
  const [fontChoice, setFontChoice] = useState('vietnam'); // 'vietnam' | 'literata' | 'lora' | 'merriweather' | 'nunito'
  const [theme, setTheme] = useState('cream'); // 'cream' | 'matcha' | 'sepia' | 'charcoal' | 'oled'
  const [syncScroll, setSyncScroll] = useState(true);

  const rawScrollRef = useRef(null);
  const transScrollRef = useRef(null);
  const isSyncingRaw = useRef(false);
  const isSyncingTrans = useRef(false);

  useEffect(() => {
    if (chapter) {
      setTranslatedTitle((chapter.translatedTitle || '').normalize('NFC'));
      setTranslatedText((chapter.translatedText || '').normalize('NFC'));
      if (chapter.qaReport) {
        setQaReport(chapter.qaReport);
      } else if (chapter.translatedText) {
        fetchAudit(chapter.translatedText);
      }
    }
  }, [chapter]);

  const fetchAudit = async (text) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/audit-chapter/${chapter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.qaReport) setQaReport(data.qaReport);
    } catch (e) {
      // silent
    }
  };

  if (!chapter) return null;

  // Handle synchronized scrolling between raw and translation panes
  const handleRawScroll = () => {
    if (!syncScroll || isSyncingRaw.current || !rawScrollRef.current || !transScrollRef.current) return;
    isSyncingTrans.current = true;
    const { scrollTop, scrollHeight, clientHeight } = rawScrollRef.current;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight || 1);
    transScrollRef.current.scrollTop = scrollRatio * (transScrollRef.current.scrollHeight - transScrollRef.current.clientHeight);
    setTimeout(() => { isSyncingTrans.current = false; }, 50);
  };

  const handleTransScroll = () => {
    if (!syncScroll || isSyncingTrans.current || !rawScrollRef.current || !transScrollRef.current) return;
    isSyncingRaw.current = true;
    const { scrollTop, scrollHeight, clientHeight } = transScrollRef.current;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight || 1);
    rawScrollRef.current.scrollTop = scrollRatio * (rawScrollRef.current.scrollHeight - rawScrollRef.current.clientHeight);
    setTimeout(() => { isSyncingRaw.current = false; }, 50);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalizedTitle = translatedTitle.normalize('NFC');
      const normalizedText = translatedText.normalize('NFC');
      const res = await fetch(`/api/projects/${project.id}/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translatedTitle: normalizedTitle,
          translatedText: normalizedText,
          status: normalizedText ? 'completed' : chapter.status,
          qaReport
        })
      });
      const data = await res.json();
      if (onUpdateChapter) onUpdateChapter(data.chapter);
    } catch (e) {
      alert('Lỗi lưu: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 1-Click Instant Auto-Fix
  const handleAutoFix = async () => {
    setAutoFixing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/auto-fix-chapter/${chapter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translatedText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranslatedText((data.chapter.translatedText || '').normalize('NFC'));
      setQaReport(data.qaReport);
      if (onUpdateChapter) onUpdateChapter(data.chapter);
      alert('Đã tự động sửa sạch rác AI, đóng ngoặc kép thoại, mượt hóa cụm từ convert, chuẩn hóa dấu câu và giãn cách đoạn chuẩn xuất bản!');
    } catch (e) {
      alert('Lỗi tự động sửa: ' + e.message);
    } finally {
      setAutoFixing(false);
    }
  };

  // 1-Click Standardize Paragraph Spacing (Ensure each paragraph and dialogue is separated by \n\n)
  const handleFormatSpacing = async () => {
    if (!translatedText) return;
    const lines = translatedText.split('\n').map(l => l.trim()).filter(Boolean);
    const formatted = lines.join('\n\n');
    setTranslatedText(formatted);
    try {
      await fetch(`/api/projects/${project.id}/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translatedText: formatted })
      });
      if (onUpdateChapter) onUpdateChapter({ ...chapter, translatedText: formatted });
    } catch (e) {
      console.warn('Lỗi lưu giãn dòng:', e);
    }
  };

  // AI Surgical Targeted Fix for a specific issue in QA report
  const handleTargetedFix = async (issue) => {
    if (!issue.targetSnippet) {
      if (issue.actionType === 'auto_fix') return handleAutoFix();
      return handleProofread();
    }
    setTargetingId(issue.id);
    try {
      const res = await fetch(`/api/projects/${project.id}/targeted-fix/${chapter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: issue.targetSnippet,
          instruction: issue.instruction,
          fullText: translatedText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranslatedText((data.translatedText || '').normalize('NFC'));
      setQaReport(data.qaReport);
      if (onUpdateChapter) onUpdateChapter(data.chapter);
      alert('AI đã sửa chính xác vị trí lỗi thành công!');
    } catch (e) {
      alert('Lỗi AI sửa: ' + e.message);
    } finally {
      setTargetingId(null);
    }
  };

  // Inline Highlighted Text AI Fixer
  const handleInlineAiFix = async (instruction) => {
    if (!selectedSnippet.trim()) return;
    setInlineFixing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/targeted-fix/${chapter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: selectedSnippet,
          instruction: instruction || customPrompt || 'Mượt hóa câu từ, đúng xưng hô',
          fullText: translatedText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranslatedText((data.translatedText || '').normalize('NFC'));
      setQaReport(data.qaReport);
      if (onUpdateChapter) onUpdateChapter(data.chapter);
      setShowInlineAiModal(false);
      setSelectedSnippet('');
      setCustomPrompt('');
    } catch (e) {
      alert('Lỗi AI sửa đoạn văn: ' + e.message);
    } finally {
      setInlineFixing(false);
    }
  };

  // Retranslate (supports strict anti-truncation mode)
  const handleReTranslate = async (strict = false) => {
    setReTranslating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/translate-chapter/${chapter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strictMode: strict })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranslatedTitle((data.chapter.translatedTitle || '').normalize('NFC'));
      setTranslatedText((data.chapter.translatedText || '').normalize('NFC'));
      setQaReport(data.chapter.qaReport);
      if (onUpdateChapter) onUpdateChapter(data.chapter);
    } catch (e) {
      alert('Lỗi dịch lại: ' + e.message);
    } finally {
      setReTranslating(false);
    }
  };

  const handleProofread = async () => {
    if (!translatedText.trim()) {
      alert('Chưa có nội dung bản dịch tiếng Việt để sửa xưng hô!');
      return;
    }
    setProofreading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/proofread-chapter/${chapter.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translatedText.normalize('NFC') })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newText = (data.chapter.translatedText || '').normalize('NFC');
      setTranslatedText(newText);
      fetchAudit(newText);
      if (onUpdateChapter) onUpdateChapter(data.chapter);
      alert('Đã chuẩn hóa xưng hô và mượt văn thành công theo bảng quy tắc nhân vật!');
    } catch (e) {
      alert('Lỗi chuẩn hóa: ' + e.message);
    } finally {
      setProofreading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${translatedTitle}\n\n${translatedText}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Capture selection inside textarea
  const handleTextareaSelect = (e) => {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    const sel = e.target.value.substring(start, end).trim();
    if (sel.length >= 3) {
      setSelectedSnippet(sel);
    }
  };

  // Find index and prev/next
  const chapters = project.chapters || [];
  const currentIndex = chapters.findIndex(c => c.id === chapter.id);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  // 5 Top-Tier Reading Themes
  const themeClasses = {
    cream: {
      name: '📜 Giấy Kem (Kindle)',
      panel: 'bg-[#fbf7ee] border-[#e8dfd3] text-[#2c231d] shadow-xl',
      headerBorder: 'border-[#e8dfd3]',
      titleColor: 'text-[#854d27]',
      inner: 'bg-[#f4ebd9] text-[#241d18] border-[#dfd2be]',
      textarea: 'bg-[#f4ebd9] text-[#241d18] border-[#dfd2be] focus:border-[#a3704c] placeholder:text-[#9c8d7e]',
      metaText: 'text-[#827163]'
    },
    matcha: {
      name: '🍵 Trà Xanh (Dịu Mắt)',
      panel: 'bg-[#f0f7f2] border-[#cfe3d5] text-[#1a3826] shadow-xl',
      headerBorder: 'border-[#cfe3d5]',
      titleColor: 'text-[#1c5c36]',
      inner: 'bg-[#e4efe7] text-[#12281b] border-[#bad8c4]',
      textarea: 'bg-[#e4efe7] text-[#12281b] border-[#bad8c4] focus:border-[#4d8c63] placeholder:text-[#6a8c75]',
      metaText: 'text-[#50775d]'
    },
    sepia: {
      name: '☕ Cà Phê Đêm (Ấm)',
      panel: 'bg-[#1b1714] border-[#362c25] text-[#f2e6db] shadow-xl',
      headerBorder: 'border-[#362c25]',
      titleColor: 'text-[#e59b5c]',
      inner: 'bg-[#241e1a] text-[#fbf2e9] border-[#44372e]',
      textarea: 'bg-[#241e1a] text-[#fbf2e9] border-[#44372e] focus:border-[#b8865f] placeholder:text-[#8a7b70]',
      metaText: 'text-[#ab9786]'
    },
    charcoal: {
      name: '🌙 Than Tối (Apple Books)',
      panel: 'bg-[#16171a] border-[#2a2c33] text-[#e2e4ea] shadow-xl',
      headerBorder: 'border-[#2a2c33]',
      titleColor: 'text-[#818cf8]',
      inner: 'bg-[#1d1f25] text-[#f5f6f9] border-[#353842]',
      textarea: 'bg-[#1d1f25] text-[#f5f6f9] border-[#353842] focus:border-[#6366f1] placeholder:text-[#797d8a]',
      metaText: 'text-[#9498a4]'
    },
    oled: {
      name: '🌌 Đen OLED (Tuyệt Đối)',
      panel: 'bg-[#000000] border-[#1f1f1f] text-[#f4f4f4] shadow-xl',
      headerBorder: 'border-[#1f1f1f]',
      titleColor: 'text-[#c084fc]',
      inner: 'bg-[#0a0a0a] text-[#ffffff] border-[#262626]',
      textarea: 'bg-[#0a0a0a] text-[#ffffff] border-[#262626] focus:border-[#a855f7] placeholder:text-[#666666]',
      metaText: 'text-[#888888]'
    }
  };

  const currentTheme = themeClasses[theme] || themeClasses.cream;

  // Font family classes
  const fontClasses = {
    vietnam: 'font-vietnam',
    literata: 'font-literata',
    lora: 'font-lora',
    merriweather: 'font-merriweather',
    nunito: 'font-nunito'
  };

  const activeFontClass = fontClasses[fontChoice] || 'font-vietnam';

  // Scoring & Quality Status
  const score = qaReport ? qaReport.score : 95;
  const isCritical = qaReport?.status === 'critical';
  const isWarning = qaReport?.status === 'warning';
  const isExcellent = qaReport?.status === 'excellent' || score >= 95;

  return (
    <div className={`space-y-3 animate-fade-in ${
      isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-4 flex flex-col h-screen overflow-hidden' : 'w-full'
    }`}>
      {/* Action & Tools Header */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        {/* Left: Navigation & Chapter Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition shadow"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                Chương {chapter.index || currentIndex + 1}
              </span>
              <h3 className="font-semibold text-white text-sm max-w-sm lg:max-w-md truncate">
                {chapter.title}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {viewMode === 'vi-only'
                ? 'Chế độ Đọc & Soát Bản Dịch Tiếng Việt (Full Focus)'
                : 'So sánh đối chiếu Song Ngữ (Raw Trung vs Bản Dịch Việt)'}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 ml-1">
            <button
              disabled={!prevChapter}
              onClick={() => onUpdateChapter(prevChapter)}
              className="p-1 hover:bg-slate-800 disabled:opacity-25 text-slate-300 rounded-lg transition"
              title="Chương trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 font-mono px-1">
              {currentIndex + 1} / {chapters.length}
            </span>
            <button
              disabled={!nextChapter}
              onClick={() => onUpdateChapter(nextChapter)}
              className="p-1 hover:bg-slate-800 disabled:opacity-25 text-slate-300 rounded-lg transition"
              title="Chương sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Display Preferences & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-0.5 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                viewMode === 'split' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chia đôi 50/50 song ngữ"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">50/50</span>
            </button>
            <button
              onClick={() => setViewMode('vi-focus')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                viewMode === 'vi-focus' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ưu tiên bản dịch (70% Dịch - 30% Raw)"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline">Ưu Tiên Dịch</span>
            </button>
            <button
              onClick={() => setViewMode('vi-only')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                viewMode === 'vi-only' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chỉ hiển thị bản dịch tiếng Việt để đọc kiểm tra cực to"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              <span>Chỉ Xem Dịch</span>
            </button>
          </div>

          {/* Font Selector Dropdown */}
          <div className="flex items-center bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 gap-1.5 text-xs">
            <Type className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              value={fontChoice}
              onChange={e => setFontChoice(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer text-xs"
              title="Chọn Font Chữ Đọc Sách"
            >
              <option value="vietnam" className="bg-slate-900">Be Vietnam Pro (Chuẩn)</option>
              <option value="literata" className="bg-slate-900">Literata (Google Books)</option>
              <option value="lora" className="bg-slate-900">Lora (Văn Học)</option>
              <option value="merriweather" className="bg-slate-900">Merriweather (Sách In)</option>
              <option value="nunito" className="bg-slate-900">Nunito (Tròn Êm Mắt)</option>
            </select>
          </div>

          {/* Font Size Zoom Controls */}
          <div className="flex items-center bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 gap-1">
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className="px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:text-white rounded"
              title="Giảm cỡ chữ"
            >
              A-
            </button>
            <span className="text-xs font-mono font-bold text-amber-300 px-1">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(28, fontSize + 2))}
              className="px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:text-white rounded"
              title="Tăng cỡ chữ"
            >
              A+
            </button>
          </div>

          {/* Theme Selector Dropdown */}
          <div className="flex items-center bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 gap-1.5 text-xs">
            <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer text-xs"
              title="Chọn Màu Nền Đọc Truyện"
            >
              <option value="cream" className="bg-slate-900">📜 Giấy Kem (Kindle)</option>
              <option value="matcha" className="bg-slate-900">🍵 Trà Xanh (Dịu Mắt)</option>
              <option value="sepia" className="bg-slate-900">☕ Cà Phê Đêm (Ấm)</option>
              <option value="charcoal" className="bg-slate-900">🌙 Than Tối (Apple Books)</option>
              <option value="oled" className="bg-slate-900">🌌 Đen OLED (Tuyệt Đối)</option>
            </select>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleBrowserFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition shadow"
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />

          {/* Action Buttons */}
          <button
            onClick={handleProofread}
            disabled={proofreading || !translatedText.trim()}
            className="px-3 py-2 bg-purple-900/80 hover:bg-purple-800 border border-purple-600/50 text-purple-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-purple-900/20"
            title="Biên tập lại bản dịch: sửa chuẩn 100% xưng hô theo ma trận nhân vật & mượt câu"
          >
            <Sparkles className={`w-3.5 h-3.5 text-purple-300 ${proofreading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{proofreading ? 'Đang sửa...' : '⚡ Sửa Xưng Hô'}</span>
          </button>

          <button
            onClick={() => handleReTranslate(false)}
            disabled={reTranslating}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
            title="Dịch lại từ đầu bản Raw tiếng Trung"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${reTranslating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{reTranslating ? 'Đang dịch...' : 'Dịch lại'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/30"
          >
            <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu bản dịch'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ENTERPRISE PRE-PUBLISHING QUALITY ASSURANCE (QA) GUARD PANEL              */}
      {/* ========================================================================= */}
      {chapter.status === 'completed' && (
        <div className="space-y-2">
          <div className={`p-3.5 rounded-2xl border transition-all shadow-lg flex flex-wrap items-center justify-between gap-3 ${
            isExcellent
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : isCritical
              ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
              : 'bg-amber-950/50 border-amber-800/80 text-amber-200'
          }`}>
            {/* Score & Verdict */}
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 shadow ${
                isExcellent
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : isCritical
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <ShieldCheck className="w-4 h-4" />
                <span>{score}/100</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wide">
                    {isExcellent
                      ? '⭐ ĐẠT CHUẨN XUẤT BẢN'
                      : isCritical
                      ? '⚠️ CẢNH BÁO LỖI NẶNG (CẦN XỬ LÝ)'
                      : '⚡ CẦN HOÀN THIỆN TRƯỚC KHI XUẤT BẢN'}
                  </span>
                  {qaReport?.issues?.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
                      {qaReport.issues.length} vấn đề
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5 line-clamp-1">
                  {qaReport?.recommendationText || (isExcellent ? 'Bản dịch sạch 100%, câu văn mượt mà, sẵn sàng xuất bản!' : 'Đã quét chất lượng.')}
                </p>
              </div>
            </div>

            {/* Smart Action Buttons to minimize manual effort */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1-Click Auto-Fix Button */}
              <button
                onClick={handleAutoFix}
                disabled={autoFixing || !translatedText}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow shadow-indigo-600/30"
                title="Tự động dọn rác AI, đóng ngoặc kép thoại, sửa cụm từ convert, chuẩn hóa dấu câu và giãn cách đoạn"
              >
                <Wrench className={`w-3.5 h-3.5 ${autoFixing ? 'animate-spin' : ''}`} />
                <span>{autoFixing ? 'Đang sửa...' : '🛠️ Sửa Nhanh 1-Click'}</span>
              </button>

              {/* Format Paragraph Spacing Button */}
              <button
                onClick={handleFormatSpacing}
                disabled={!translatedText}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-amber-500/30"
                title="Tự động giãn dòng: mỗi đoạn văn & câu thoại cách nhau đúng 1 dòng trống chuẩn tiểu thuyết"
              >
                <span>¶ Giãn Đoạn Xuống Dòng</span>
              </button>

              {/* Critical Retranslate Button */}
              {isCritical && (
                <button
                  onClick={() => handleReTranslate(true)}
                  disabled={reTranslating}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-rose-600/40 animate-bounce"
                  title="Bản dịch bị nuốt chữ hoặc kẹt vòng lặp. Bấm để AI dịch lại toàn bộ với chỉ thị nghiêm ngặt chống nuốt chữ!"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reTranslating ? 'animate-spin' : ''}`} />
                  <span>Dịch Lại Khắc Phục</span>
                </button>
              )}

              {/* Toggle 7-Pillars QA Breakdown */}
              <button
                onClick={() => setShowQaDetails(!showQaDetails)}
                className="px-2.5 py-1.5 bg-black/30 hover:bg-black/50 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1 transition"
                title="Xem chi tiết 7 tiêu chí kiểm định tiền xuất bản"
              >
                <span>7 Tiêu Chí</span>
                {showQaDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-black/30 text-slate-300 hover:text-white rounded-xl text-xs transition"
                title="Sao chép nội dung dịch"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Detailed 7-Pillars QA Diagnostic Grid */}
          {showQaDetails && qaReport && (
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3 text-xs text-slate-300 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" /> Bảng Thẩm Định 7 Tiêu Chí Xuất Bản
                </span>
                <span className="text-[11px] text-slate-400">
                  Tỷ lệ độ dài: <strong>{qaReport.stats.lengthRatio}x</strong> (Bản dịch: {qaReport.stats.viWordCount} từ / Raw: {qaReport.stats.rawCharCount} ký tự)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {/* 1. Chinese Glyphs */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${qaReport.stats.chineseCharCount === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {qaReport.stats.chineseCharCount === 0 ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Chữ Hán & Dấu Câu Trung</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {qaReport.stats.chineseCharCount === 0 ? 'Sạch 100%, không sót chữ Hán' : `Còn ${qaReport.stats.chineseCharCount} chữ Hán chưa dịch`}
                    </p>
                  </div>
                </div>

                {/* 2. Truncation / Omission */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${qaReport.stats.lengthRatio >= 0.5 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {qaReport.stats.lengthRatio >= 0.5 ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Độ Dài & Nuốt Chữ</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {qaReport.stats.lengthRatio >= 0.5 ? 'Dung lượng đầy đủ trọn vẹn' : 'Cảnh báo: AI nuốt chữ hoặc tóm tắt!'}
                    </p>
                  </div>
                </div>

                {/* 3. AI Meta & Chatter */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${qaReport.stats.aiMetaCount === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {qaReport.stats.aiMetaCount === 0 ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Rác AI / Lời Dẫn</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {qaReport.stats.aiMetaCount === 0 ? 'Không dính câu chào/chú thích ngoài' : `Phát hiện ${qaReport.stats.aiMetaCount} câu rác AI (Có thể Sửa Nhanh)`}
                    </p>
                  </div>
                </div>

                {/* 4. Convert Artifacts */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${qaReport.stats.convertArtifactCount <= 2 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {qaReport.stats.convertArtifactCount <= 2 ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Cụm Từ Convert Thô</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {qaReport.stats.convertArtifactCount <= 2 ? 'Văn phong tự nhiên, mượt mà' : `Có ${qaReport.stats.convertArtifactCount} cụm từ convert thô`}
                    </p>
                  </div>
                </div>

                {/* 5. Dialogue Quotes */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${qaReport.stats.quoteBalanced ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {qaReport.stats.quoteBalanced ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Dấu Ngoặc Kép Thoại</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {qaReport.stats.quoteBalanced ? 'Dấu ngoặc kép cân xứng chuẩn xác' : 'Bị lẻ dấu ngoặc kép (Chưa đóng thoại)'}
                    </p>
                  </div>
                </div>

                {/* 6. Pronoun Consistency */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg shrink-0 bg-purple-500/10 text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Xưng Hô Theo Ma Trận</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Khớp với ma trận nhân vật của bộ truyện
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Issue List with Targeted AI Fix buttons */}
              {qaReport.issues.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                    Danh sách lỗi & Tùy chọn sửa đích danh bằng AI:
                  </span>
                  <div className="space-y-1.5">
                    {qaReport.issues.map((iss, idx) => (
                      <div
                        key={iss.id || idx}
                        className={`p-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 transition ${
                          iss.severity === 'critical'
                            ? 'bg-rose-950/40 text-rose-200 border border-rose-800/50'
                            : 'bg-slate-900/90 text-slate-200 border border-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-2 max-w-xl">
                          {iss.severity === 'critical' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-medium leading-relaxed">{iss.message}</span>
                            {iss.targetSnippet && (
                              <p className="text-[11px] opacity-80 font-mono mt-1 bg-black/30 px-2 py-0.5 rounded border border-white/5 line-clamp-2">
                                "{iss.targetSnippet}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Surgical Targeted AI Fix Button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {iss.actionType === 'ai_fix' && (
                            <button
                              onClick={() => handleTargetedFix(iss)}
                              disabled={targetingId === iss.id}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-purple-900/30"
                              title="Yêu cầu AI sửa chính xác câu này theo ma trận nhân vật mà không chạm vào các phần khác"
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${targetingId === iss.id ? 'animate-spin' : ''}`} />
                              <span>{targetingId === iss.id ? 'Đang sửa...' : '⚡ AI Sửa Chỗ Này'}</span>
                            </button>
                          )}
                          {iss.actionType === 'auto_fix' && (
                            <button
                              onClick={handleAutoFix}
                              disabled={autoFixing}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow"
                              title="Tự động sửa lỗi này ngay lập tức"
                            >
                              <Wrench className="w-3.5 h-3.5" /> Sửa tự động
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Panes Display */}
      <div className={`grid gap-4 ${
        viewMode === 'vi-only'
          ? 'grid-cols-1'
          : viewMode === 'zh-only'
          ? 'grid-cols-1'
          : viewMode === 'vi-focus'
          ? 'grid-cols-1 lg:grid-cols-12'
          : 'grid-cols-1 lg:grid-cols-2'
      } ${isFullscreen ? 'flex-1 overflow-hidden' : 'h-[calc(100vh-230px)] min-h-[720px]'}`}>

        {/* Left: Original Chinese Text */}
        {(viewMode === 'split' || viewMode === 'vi-focus' || viewMode === 'zh-only') && (
          <div className={`border rounded-2xl p-5 flex flex-col h-full overflow-hidden transition-all ${
            currentTheme.panel
          } ${
            viewMode === 'vi-focus' ? 'lg:col-span-4' : viewMode === 'zh-only' ? 'col-span-1' : ''
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-3 shrink-0 ${currentTheme.headerBorder}`}>
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${currentTheme.titleColor}`}>
                <span>🇨🇳</span> Bản Gốc Tiếng Trung (Raw)
              </span>
              <span className={`text-xs font-mono ${currentTheme.metaText}`}>
                {chapter.originalText ? chapter.originalText.length : 0} ký tự
              </span>
            </div>

            <div className="mb-3 shrink-0">
              <label className={`text-[10px] uppercase font-bold tracking-wider ${currentTheme.metaText}`}>Tiêu đề gốc</label>
              <div className="font-bold text-base mt-0.5">{chapter.title}</div>
            </div>

            <div
              ref={rawScrollRef}
              onScroll={handleRawScroll}
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: '2.2'
              }}
              className={`flex-1 overflow-y-auto pr-4 whitespace-pre-wrap rounded-xl p-4 border ${activeFontClass} ${currentTheme.inner}`}
            >
              {chapter.originalText ? chapter.originalText.normalize('NFC') : <span className="italic opacity-60">Không có nội dung bản gốc.</span>}
            </div>
          </div>
        )}

        {/* Right: Vietnamese Translated Text (Editable) */}
        {(viewMode === 'split' || viewMode === 'vi-focus' || viewMode === 'vi-only') && (
          <div className={`border rounded-2xl p-5 flex flex-col h-full overflow-hidden transition-all ${
            currentTheme.panel
          } ${
            viewMode === 'vi-focus' ? 'lg:col-span-8' : viewMode === 'vi-only' ? 'col-span-1 max-w-5xl mx-auto w-full' : ''
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-3 shrink-0 ${currentTheme.headerBorder}`}>
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${currentTheme.titleColor}`}>
                <span>🇻🇳</span> Bản Dịch Tiếng Việt (Biên Tập Trực Tiếp)
              </span>
              <span className={`text-xs font-mono ${currentTheme.metaText}`}>
                {translatedText ? translatedText.split(/\s+/).filter(Boolean).length : 0} từ
              </span>
            </div>

            <div className="mb-3 space-y-1 shrink-0">
              <label className={`text-[10px] uppercase font-bold tracking-wider ${currentTheme.metaText}`}>Tiêu đề dịch</label>
              <input
                type="text"
                value={translatedTitle}
                onChange={e => setTranslatedTitle(e.target.value)}
                placeholder="Chương 1: ..."
                className={`w-full rounded-xl px-4 py-2.5 text-base font-bold focus:outline-none shadow-inner border ${activeFontClass} ${currentTheme.textarea}`}
              />
            </div>

            {/* Floating Selection AI Assistant Bar */}
            {selectedSnippet && (
              <div className="mb-2 p-2.5 bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border border-purple-600/50 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-xl animate-fade-in text-xs text-purple-200">
                <div className="flex items-center gap-2 max-w-md truncate">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Đã chọn: <strong className="text-white">"{selectedSnippet.slice(0, 35)}..."</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleInlineAiFix('Chuẩn hóa 100% đại từ xưng hô theo ma trận nhân vật')}
                    disabled={inlineFixing}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition shadow"
                    title="AI sửa đúng đại từ xưng hô của đoạn bôi đen này"
                  >
                    ⚡ Sửa Xưng Hô
                  </button>
                  <button
                    onClick={() => handleInlineAiFix('Mượt hóa câu văn, xóa bỏ convert thô, diễn đạt hấp dẫn')}
                    disabled={inlineFixing}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition shadow"
                    title="AI mượt hóa câu văn đoạn này"
                  >
                    ✍️ Mượt Câu
                  </button>
                  <button
                    onClick={() => setShowInlineAiModal(true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
                    title="Tự nhập yêu cầu riêng cho AI"
                  >
                    💬 Yêu Cầu Riêng...
                  </button>
                  <button
                    onClick={() => setSelectedSnippet('')}
                    className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-md"
                    title="Đóng thanh này"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
              <textarea
                ref={transScrollRef}
                onScroll={handleTransScroll}
                onSelect={handleTextareaSelect}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: '2.2'
                }}
                value={translatedText}
                onChange={e => setTranslatedText(e.target.value)}
                placeholder="Chưa có bản dịch. Bấm 'Dịch lại' ở trên để tiến hành dịch chương này..."
                className={`w-full flex-1 rounded-xl p-5 resize-none focus:outline-none shadow-inner border ${activeFontClass} ${currentTheme.textarea}`}
              />
            </div>
          </div>
        )}

      </div>

      {/* Custom Prompt Modal for Selected Snippet */}
      {showInlineAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-purple-600/50 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 text-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-white">AI Sửa Đoạn Văn Đã Chọn</h4>
              </div>
              <button
                onClick={() => setShowInlineAiModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Đoạn văn được chọn ({selectedSnippet.length} ký tự):
              </label>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-serif leading-relaxed max-h-32 overflow-y-auto">
                "{selectedSnippet}"
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                Chỉ đạo của bạn cho AI (Nhập yêu cầu tùy ý):
              </label>
              <textarea
                rows={2}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Ví dụ: Đổi xưng hô thành tỷ tỷ - muội muội, diễn đạt câu văn cho bi thương hơn..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowInlineAiModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
              >
                Hủy
              </button>
              <button
                onClick={() => handleInlineAiFix(customPrompt)}
                disabled={inlineFixing || !customPrompt.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center gap-1.5 transition shadow-lg shadow-purple-600/30"
              >
                <Sparkles className={`w-3.5 h-3.5 ${inlineFixing ? 'animate-spin' : ''}`} />
                <span>{inlineFixing ? 'Đang sửa...' : 'Thực Hiện Sửa Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
