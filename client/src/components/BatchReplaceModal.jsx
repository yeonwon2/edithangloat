import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Plus, Trash2, RotateCcw, AlertTriangle, CheckCircle2, X, Sparkles, BookOpen, Layers } from 'lucide-react';

export default function BatchReplaceModal({
  isOpen,
  onClose,
  project,
  selectedChapter,
  onProjectUpdated
}) {
  if (!isOpen || !project) return null;

  const chapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);
  const currentChapter = selectedChapter || chapters[0];

  const [rules, setRules] = useState([{ find: '', replace: '' }]);
  const [scope, setScope] = useState('story'); // 'story' | 'chapter'
  const [wholeWord, setWholeWord] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPreview(null);
      setStatusMsg(null);
      const settings = project.settings || {};
      setCanUndo(Boolean(settings.lastBatchReplaceUndo || settings.lastStoryQaUndo));
    }
  }, [isOpen, project]);

  const addRule = () => {
    setPreview(null);
    setRules([...rules, { find: '', replace: '' }]);
  };

  const updateRule = (idx, field, value) => {
    setPreview(null);
    const updated = rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setRules(updated);
  };

  const removeRule = (idx) => {
    setPreview(null);
    if (rules.length <= 1) {
      setRules([{ find: '', replace: '' }]);
    } else {
      setRules(rules.filter((_, i) => i !== idx));
    }
  };

  // Preview matches
  const handlePreview = async () => {
    const validRules = rules.filter(r => r.find.trim().length > 0);
    if (!validRules.length) {
      alert('Vui lòng nhập ít nhất một cụm từ cần tìm kiếm!');
      return;
    }

    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/batch-replace/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: validRules,
          scope,
          chapterId: scope === 'chapter' ? currentChapter?.id : null,
          wholeWord
        })
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data);
      } else {
        alert(data.message || 'Lỗi khi quét tìm kiếm');
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Apply replacement
  const handleApply = async () => {
    const validRules = rules.filter(r => r.find.trim().length > 0);
    if (!validRules.length) {
      alert('Vui lòng nhập từ cần thay thế!');
      return;
    }

    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/batch-replace/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: validRules,
          scope,
          chapterId: scope === 'chapter' ? currentChapter?.id : null,
          wholeWord
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setCanUndo(true);
        setPreview(null);
        if (onProjectUpdated) onProjectUpdated();
      } else {
        setStatusMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Undo replacement
  const handleUndo = async () => {
    if (!confirm('Bạn có chắc chắn muốn hoàn tác lần thay thế gần nhất không?')) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/batch-replace/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setCanUndo(false);
        setPreview(null);
        if (onProjectUpdated) onProjectUpdated();
      } else {
        setStatusMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Thay Thế Hàng Loạt (Batch Replace)</h3>
              <p className="text-xs text-slate-400">
                Tìm kiếm và thay thế chuẩn tiếng Việt, có xem trước (Preview) và Hoàn tác (Undo) an toàn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs text-slate-300">
          {/* Status message */}
          {statusMsg && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Scope and options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Phạm vi áp dụng:
              </label>
              <select
                value={scope}
                onChange={e => { setScope(e.target.value); setPreview(null); }}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="story">Toàn bộ truyện ({chapters.length} chương)</option>
                <option value="chapter">Chương đang mở (#{currentChapter?.chapterIndex || currentChapter?.index || '1'})</option>
              </select>
            </div>

            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={wholeWord}
                  onChange={e => { setWholeWord(e.target.checked); setPreview(null); }}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <span>Khớp nguyên từ tiếng Việt (Tránh sửa nhầm từ con)</span>
              </label>
            </div>
          </div>

          {/* Rules list */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Danh sách từ cần thay thế:
              </label>
              <button
                type="button"
                onClick={addRule}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm cặp từ
              </button>
            </div>

            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rule.find}
                    onChange={e => updateRule(idx, 'find', e.target.value)}
                    placeholder="Từ hoặc cụm từ cần tìm..."
                    className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-slate-500 font-bold">➔</span>
                  <input
                    type="text"
                    value={rule.replace}
                    onChange={e => updateRule(idx, 'replace', e.target.value)}
                    placeholder="Thay bằng..."
                    className="flex-1 bg-slate-950 border border-slate-700 text-emerald-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Results (if scanned) */}
          {preview && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 text-xs">
                  Kết quả quét: Tìm thấy {preview.totalMatches} vị trí trong {preview.chapterCount} chương
                </span>
                <span className="text-[10px] text-slate-500">Chưa có văn bản nào bị sửa</span>
              </div>

              {preview.chapterMatches && preview.chapterMatches.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {preview.chapterMatches.map((cm, i) => (
                    <div key={i} className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-white">#Chương {cm.chapterIndex}: {cm.title}</strong>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold text-[10px]">
                          {cm.count} vị trí
                        </span>
                      </div>
                      {cm.samples && cm.samples.length > 0 && (
                        <div className="text-[10px] text-slate-400 italic bg-black/30 p-1 rounded font-mono">
                          ...{cm.samples[0]}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs py-2 text-center">Không tìm thấy từ cần thay trong phạm vi đã chọn.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex justify-between items-center">
          {canUndo ? (
            <button
              onClick={handleUndo}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác lần gần nhất
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Đóng
            </button>

            {scope === 'story' && !preview ? (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Search className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Đang quét...' : '🔍 Quét Xem Trước (Preview)'}
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={loading || (preview && preview.totalMatches === 0)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-600/30 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Đang thực hiện...' : scope === 'chapter' ? 'Áp dụng vào chương' : `Áp dụng toàn bộ truyện (${preview?.totalMatches || 0} vị trí)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
