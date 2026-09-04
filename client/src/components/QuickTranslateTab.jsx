import React, { useState } from 'react';
import { Zap, Copy, Download, Sparkles, CheckCircle2, AlertCircle, ArrowRight, PlusCircle, RefreshCw, FileText } from 'lucide-react';

export default function QuickTranslateTab({ project, onUpdateProject, onSwitchToQueue }) {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [issues, setIssues] = useState([]);
  const [chineseCharCount, setChineseCharCount] = useState(0);
  const [fontSize, setFontSize] = useState(16);

  // Settings
  const [genre, setGenre] = useState(project?.genre || 'Tiên Hiệp');
  const [toneGuidance, setToneGuidance] = useState(project?.toneGuidance || 'Văn phong cổ phong, xưng hô tôn ti rõ ràng, ta-ngươi');
  const [model, setModel] = useState(project?.model || 'gemini-3.5-flash-lite');
  const [workMode, setWorkMode] = useState('translate'); // 'translate' | 'proofread'

  const handleQuickTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setIssues([]);
    try {
      const endpoint = workMode === 'proofread' ? '/api/quick-proofread' : '/api/quick-translate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          title: '',
          genre,
          toneGuidance,
          model,
          characters: project?.characters || [],
          pronounMatrix: project?.pronounMatrix || [],
          terms: project?.terms || []
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranslatedTitle(data.translatedTitle || (workMode === 'proofread' ? 'Bản Đã Chuẩn Hóa Xưng Hô' : ''));
      setTranslatedText(data.translatedText);
      setIssues(data.issues || []);
      setChineseCharCount(data.chineseCharCount || 0);
    } catch (e) {
      alert('Lỗi xử lý: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToProject = async () => {
    if (!inputText.trim() || !project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/import-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Đã bóc tách và thêm thành công ${data.count} chương vào dự án "${project.title}"!`);
      if (onSwitchToQueue) onSwitchToQueue();
    } catch (e) {
      alert('Lỗi nạp vào dự án: ' + e.message);
    }
  };

  const handleCopy = () => {
    const full = translatedTitle ? `${translatedTitle}\n\n${translatedText}` : translatedText;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const full = translatedTitle ? `${translatedTitle}\n\n${translatedText}` : translatedText;
    const blob = new Blob([full], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${translatedTitle || 'Ban_dich'}.txt`;
    a.click();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Banner & Options */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl text-white shadow-md ${
            workMode === 'proofread' ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gradient-to-tr from-amber-500 to-orange-500'
          }`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">
                {workMode === 'proofread' ? 'Biên Tập & Sửa Chuẩn Xưng Hô Tiếng Việt' : 'Dán Văn Bản Trực Tiếp & Dịch Nhanh'}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {workMode === 'proofread'
                ? 'Dán bản dịch tiếng Việt bị sai xưng hô / convert thô ráp vào đây để AI chuẩn hóa 100% theo Ma Trận Nhân Vật'
                : 'Dán bất kỳ đoạn văn, 1 chương hoặc nhiều chương tiếng Trung vào đây để dịch ngay lập tức'}
            </p>
          </div>
        </div>

        {/* Mode Selector & Quick Settings */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Work Mode Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              onClick={() => setWorkMode('translate')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                workMode === 'translate'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🇨🇳 Dịch Trung ➔ Việt
            </button>
            <button
              onClick={() => setWorkMode('proofread')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                workMode === 'proofread'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ✨ Sửa Xưng Hô Tiếng Việt
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-slate-400">Thể loại:</span>
            <select
              value={genre}
              onChange={e => setGenre(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Tiên Hiệp" className="bg-slate-900">Tiên Hiệp</option>
              <option value="Huyền Huyễn" className="bg-slate-900">Huyền Huyễn</option>
              <option value="Đô Thị" className="bg-slate-900">Đô Thị</option>
              <option value="Bách Hợp / GL" className="bg-slate-900">Bách Hợp / GL</option>
              <option value="Đam Mỹ / BL" className="bg-slate-900">Đam Mỹ / BL</option>
              <option value="Ngôn Tình" className="bg-slate-900">Ngôn Tình</option>
              <option value="Cổ Đại" className="bg-slate-900">Cổ Đại</option>
              <option value="Võ Hiệp" className="bg-slate-900">Võ Hiệp</option>
              <option value="Mạt Thế" className="bg-slate-900">Mạt Thế</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1">
            <span className="text-slate-400">Model:</span>
            <input
              type="text"
              list="quick-models-list"
              value={model}
              onChange={e => setModel(e.target.value.trim())}
              placeholder="gemini-3.5-flash-lite..."
              className="bg-transparent text-slate-200 font-semibold focus:outline-none font-mono text-xs w-36"
            />
            <datalist id="quick-models-list">
              <option value="gemini-3.5-flash-lite" />
              <option value="gemini-3.5-flash" />
              <option value="gemini-2.5-flash" />
              <option value="gemini-2.5-pro" />
            </datalist>
          </div>
          {/* Font size zoom controls */}
          <div className="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-700">
            <button
              onClick={() => setFontSize(Math.max(13, fontSize - 2))}
              className="px-2 py-1 text-xs font-bold text-slate-300 hover:text-white"
              title="Giảm cỡ chữ"
            >
              A-
            </button>
            <span className="text-[11px] px-1 text-indigo-300 font-mono">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(26, fontSize + 2))}
              className="px-2 py-1 text-xs font-bold text-slate-300 hover:text-white"
              title="Tăng cỡ chữ"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Two Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-230px)] min-h-[720px]">
        {/* Left Pane: Paste Input */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>{workMode === 'proofread' ? '🇻🇳' : '🇨🇳'}</span>{' '}
              {workMode === 'proofread'
                ? 'Ô Dán Bản Dịch Tiếng Việt (Cần sửa xưng hô / convert thô ráp)'
                : 'Ô Dán Văn Bản Tiếng Trung (Raw / Convert)'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {inputText.length} ký tự
            </span>
          </div>

          <textarea
            style={{ fontSize: `${fontSize}px` }}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              workMode === 'proofread'
                ? 'Dán bản dịch tiếng Việt đang bị lủng củng, lộn xộn xưng hô hoặc truyện convert thô vào đây...\n\nAI sẽ tự động áp dụng Ma Trận Nhân Vật & Ngôi Lời Dẫn của dự án để chuẩn hóa lại 100% từng câu thoại và lời dẫn!'
                : 'Dán văn bản tiếng Trung gốc vào đây...\n\nVí dụ:\n第一章 少年出山\n大荒无垠，群山巍峨。石村坐落在苍莽山脉中，四周高峰大壑，茫茫群山。\n“斗之力，三段！”少年面无表情...'
            }
            className="w-full flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 leading-loose resize-none focus:outline-none focus:border-indigo-500 font-sans placeholder:text-slate-600"
          />

          {/* Action buttons under input */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={() => setInputText('')}
              disabled={!inputText}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Xóa trắng
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddToProject}
                disabled={!inputText.trim() || !project}
                title="Tự động bóc tách các chương và thêm vào danh sách dịch hàng loạt"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
              >
                <PlusCircle className="w-4 h-4 text-indigo-400" /> Bóc tách vào Hàng Đợi
              </button>

              <button
                onClick={handleQuickTranslate}
                disabled={!inputText.trim() || loading}
                className={`px-5 py-2 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg ${
                  workMode === 'proofread'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
                }`}
              >
                <Zap className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Đang xử lý...' : workMode === 'proofread' ? '⚡ Sửa Chuẩn Xưng Hô' : '⚡ Dịch Ngay'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: Translation Output */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>✨</span>{' '}
                {workMode === 'proofread'
                  ? 'Bản Đã Chuẩn Hóa Xưng Hô & Mượt Văn'
                  : 'Kết Quả Dịch Tiếng Việt Chuẩn'}
              </span>
              {translatedText && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  chineseCharCount === 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {chineseCharCount === 0 ? 'Sạch 100%' : `Sót ${chineseCharCount} chữ Hán`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {translatedText && (
                <>
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-400" /> {copied ? 'Đã sao chép!' : 'Sao chép'}
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" /> Tải .txt
                  </button>
                </>
              )}
            </div>
          </div>

          {translatedTitle && (
            <div className="mb-2">
              <input
                type="text"
                value={translatedTitle}
                onChange={e => setTranslatedTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <textarea
            value={translatedText}
            onChange={e => setTranslatedText(e.target.value)}
            placeholder="Kết quả bản dịch tiếng Việt mượt mà sẽ hiển thị tại đây sau khi bấm 'Dịch Ngay'..."
            className="w-full flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-100 text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500 font-sans placeholder:text-slate-600"
          />

          {issues.length > 0 && (
            <div className="mt-2 p-2 bg-amber-950/30 border border-amber-800/40 rounded-lg text-[11px] text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>{issues.join(' • ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
