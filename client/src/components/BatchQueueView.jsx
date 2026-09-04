import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, FileText, CheckCircle2, AlertCircle, Clock, Trash2, Eye, Plus, ChevronDown, ChevronUp, Terminal, ShieldCheck } from 'lucide-react';
import PronounInspectorModal from './PronounInspectorModal';

export default function BatchQueueView({ project, onUpdateProject, onSelectChapterForEdit, onOpenImportModal }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [queueStatus, setQueueStatus] = useState({ isRunning: false, completedCount: 0, totalCount: 0, logs: [] });
  const [showLogs, setShowLogs] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'error'
  const [translatingSingleId, setTranslatingSingleId] = useState(null);
  const [inspectorChapter, setInspectorChapter] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const chapters = project?.chapters || [];

  // Poll queue status while queue is running
  useEffect(() => {
    let timer = null;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/queue/status`);
        const data = await res.json();
        setQueueStatus(data);

        // If queue is running, refresh project data periodically to show updated chapters
        if (data.isRunning) {
          const projRes = await fetch(`/api/projects/${project.id}`);
          const projData = await projRes.json();
          if (projData.project) onUpdateProject(projData.project);
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkStatus();
    timer = setInterval(checkStatus, 2500);

    return () => clearInterval(timer);
  }, [project.id]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredChapters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredChapters.map(c => c.id));
    }
  };

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleStartQueue = async (targetIds = null) => {
    try {
      await fetch(`/api/projects/${project.id}/queue/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIds: targetIds })
      });
      setShowLogs(true);
    } catch (e) {
      alert('Lỗi khởi động hàng đợi: ' + e.message);
    }
  };

  const handleStopQueue = async () => {
    try {
      await fetch(`/api/projects/${project.id}/queue/stop`, { method: 'POST' });
    } catch (e) {
      alert('Lỗi dừng hàng đợi: ' + e.message);
    }
  };

  const handleTranslateSingle = async (chapterId) => {
    setTranslatingSingleId(chapterId);
    try {
      const res = await fetch(`/api/projects/${project.id}/translate-chapter/${chapterId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update chapter in project
      const updated = chapters.map(c => c.id === chapterId ? data.chapter : c);
      onUpdateProject({ ...project, chapters: updated });
    } catch (e) {
      alert('Lỗi dịch chương: ' + e.message);
    } finally {
      setTranslatingSingleId(null);
    }
  };

  const handleDeleteChapter = async (chapterId) => {
    if (!confirm('Bạn có chắc muốn xóa chương này?')) return;
    try {
      await fetch(`/api/projects/${project.id}/chapters/${chapterId}`, { method: 'DELETE' });
      const updated = chapters.filter(c => c.id !== chapterId);
      onUpdateProject({ ...project, chapters: updated });
    } catch (e) {
      alert('Lỗi xóa chương: ' + e.message);
    }
  };

  // Filtered chapters
  const filteredChapters = chapters.filter(c => {
    if (filter === 'pending') return c.status === 'pending' || !c.status;
    if (filter === 'completed') return c.status === 'completed';
    if (filter === 'error') return c.status === 'error';
    return true;
  });

  const completedCount = chapters.filter(c => c.status === 'completed').length;
  const pendingCount = chapters.filter(c => c.status === 'pending' || !c.status).length;
  const errorCount = chapters.filter(c => c.status === 'error').length;
  const progressPercent = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Xưởng Dịch Hàng Loạt</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Tổng số: {chapters.length} chương
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Hàng đợi chạy tự động, truyền tóm tắt ngữ cảnh giữa các chương để duy trì xưng hô xuyên suốt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Model Selector for Batch Queue */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Model:</span>
            <input
              type="text"
              list="batch-models-list"
              value={project.model || 'gemini-3.5-flash-lite'}
              onChange={async (e) => {
                const newModel = e.target.value.trim();
                const updatedProj = { ...project, model: newModel };
                onUpdateProject(updatedProj);
                await fetch(`/api/projects/${project.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: newModel })
                });
              }}
              placeholder="gemini-3.5-flash-lite..."
              className="bg-transparent text-indigo-300 font-semibold focus:outline-none font-mono text-xs w-36"
            />
            <datalist id="batch-models-list">
              <option value="gemini-3.5-flash-lite" />
              <option value="gemini-2.0-flash" />
              <option value="gemini-1.5-flash" />
              <option value="gemini-1.5-pro" />
            </datalist>
          </div>

          <button
            onClick={onOpenImportModal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <Plus className="w-4 h-4 text-indigo-400" /> Thêm / Nạp Chương
          </button>

          {queueStatus.isRunning ? (
            <button
              onClick={handleStopQueue}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-amber-600/30"
            >
              <Pause className="w-4 h-4" /> Tạm Dừng
            </button>
          ) : (
            <button
              onClick={() => handleStartQueue(null)}
              disabled={pendingCount === 0}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-600/30"
            >
              <Play className="w-4 h-4" /> Dịch Tất Cả Chưa Dịch ({pendingCount})
            </button>
          )}

          {selectedIds.length > 0 && !queueStatus.isRunning && (
            <button
              onClick={() => handleStartQueue(selectedIds)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <Play className="w-4 h-4" /> Dịch Đã Chọn ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Direct Quick Paste Panel */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>📋</span> Dán Trực Tiếp Văn Bản Vào Đây (Tự động nhận diện & bóc chương)
          </span>
          <span className="text-[11px] text-slate-500">
            Dán 1 chương, nhiều chương hoặc cả bộ truyện thô
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            rows={2}
            id="inlineQuickPaste"
            placeholder="Dán văn bản tiếng Trung hoặc truyện chữ vào đây... (Hỗ trợ 第1章, 第一章, Chương 1... hoặc văn bản tùy ý)"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-y min-h-[44px]"
          />
          <button
            onClick={async () => {
              const el = document.getElementById('inlineQuickPaste');
              const text = el ? el.value : '';
              if (!text.trim()) {
                alert('Vui lòng dán nội dung văn bản vào ô trước!');
                return;
              }
              try {
                const res = await fetch(`/api/projects/${project.id}/import-text`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                el.value = '';
                const projRes = await fetch(`/api/projects/${project.id}`);
                const projData = await projRes.json();
                if (projData.project) onUpdateProject(projData.project);
                alert(`Đã bóc tách và thêm thành công ${data.count} chương vào hàng đợi!`);
              } catch (err) {
                alert('Lỗi nạp văn bản: ' + err.message);
              }
            }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20 shrink-0 h-[44px]"
          >
            <Plus className="w-4 h-4" /> Bóc & Thêm Vào Hàng Đợi
          </button>
        </div>
      </div>

      {/* Progress Bar Banner */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Tiến độ dự án: {progressPercent}%</span>
            {queueStatus.isRunning && (
              <span className="text-indigo-400 flex items-center gap-1 font-medium animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> {queueStatus.currentChapterTitle || 'Đang xử lý...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="text-emerald-400">✓ Đã dịch: {completedCount}</span>
            <span className="text-slate-400">⏳ Chờ: {pendingCount}</span>
            {errorCount > 0 && <span className="text-red-400">✗ Lỗi: {errorCount}</span>}
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <Terminal className="w-3.5 h-3.5" /> Nhật ký dịch {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Bar */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Collapsible Log Terminal */}
        {showLogs && (
          <div className="mt-3 p-3 bg-black/90 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
            {queueStatus.logs && queueStatus.logs.length > 0 ? (
              queueStatus.logs.map((log, idx) => (
                <div key={idx} className={log.includes('✓') ? 'text-emerald-400' : log.includes('✗') ? 'text-red-400' : 'text-slate-400'}>
                  {log}
                </div>
              ))
            ) : (
              <div className="text-slate-600">Chưa có nhật ký hoạt động.</div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs & Bulk Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Tất cả ({chapters.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Chờ dịch ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'completed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Đã hoàn thành ({completedCount})
          </button>
          {errorCount > 0 && (
            <button
              onClick={() => setFilter('error')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === 'error' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Lỗi ({errorCount})
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400">
          Đã chọn: <span className="text-indigo-400 font-bold">{selectedIds.length}</span> chương
        </div>
      </div>

      {/* Chapters Table */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredChapters.length && filteredChapters.length > 0}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-3 py-3 w-14">#</th>
              <th className="px-4 py-3">Tiêu đề gốc (Raw)</th>
              <th className="px-4 py-3">Tiêu đề dịch (Việt)</th>
              <th className="px-4 py-3">Số từ</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Chất lượng</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredChapters.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-medium text-slate-400">Chưa có chương truyện nào ở mục này</p>
                  <p className="text-xs mt-1">Bấm "Thêm / Nạp Chương" ở góc trên để dán hoặc tải file truyện lên.</p>
                </td>
              </tr>
            ) : (
              filteredChapters.map((ch, idx) => {
                const isSelected = selectedIds.includes(ch.id);
                const isTranslating = translatingSingleId === ch.id || (queueStatus.isRunning && queueStatus.currentChapterId === ch.id);

                return (
                  <tr
                    key={ch.id}
                    className={`hover:bg-slate-800/40 transition ${isSelected ? 'bg-indigo-950/20' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(ch.id)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-400">{ch.index || idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-200 max-w-[220px] truncate" title={ch.title}>
                      {ch.title}
                    </td>
                    <td className="px-4 py-3 font-medium text-indigo-300 max-w-[240px] truncate" title={ch.translatedTitle}>
                      {ch.translatedTitle || <span className="text-slate-600 italic">Chưa dịch</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{ch.wordCount || '—'}</td>
                    <td className="px-4 py-3">
                      {isTranslating ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1 w-fit">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Đang dịch...
                        </span>
                      ) : ch.status === 'completed' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Hoàn tất
                        </span>
                      ) : ch.status === 'error' ? (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-medium flex items-center gap-1 w-fit" title={ch.error}>
                          <AlertCircle className="w-3 h-3" /> Lỗi
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-medium flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> Chờ dịch
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ch.status === 'completed' ? (
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            onClick={() => {
                              setInspectorChapter(ch);
                              setIsInspectorOpen(true);
                            }}
                            title="Bấm để xem báo cáo đối chiếu xưng hô với các chương khác"
                            className="text-[10px] text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1 font-semibold transition"
                          >
                            <ShieldCheck className="w-3 h-3 text-indigo-400" />
                            <span>Xưng hô 100%</span>
                          </button>
                          {ch.chineseCharCount > 0 ? (
                            <span className="text-[9px] text-amber-400">
                              Sót {ch.chineseCharCount} chữ Hán
                            </span>
                          ) : (
                            <span className="text-[9px] text-emerald-400 font-medium">
                              ✓ Sạch chữ Hán
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleTranslateSingle(ch.id)}
                          disabled={isTranslating}
                          title="Dịch chương này"
                          className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectChapterForEdit(ch)}
                          title="Xem so sánh & Chỉnh sửa"
                          className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(ch.id)}
                          title="Xóa chương"
                          className="p-1.5 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pronoun Inspector Modal */}
      <PronounInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        project={project}
        selectedChapter={inspectorChapter}
      />
    </div>
  );
}
