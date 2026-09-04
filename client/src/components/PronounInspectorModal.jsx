import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Users, CheckCircle2, ArrowRight, X, RefreshCw, Sparkles, Wand2, BookOpen, Layers, Check, FileCheck, SearchCheck, Zap, RotateCcw } from 'lucide-react';

export default function PronounInspectorModal({ isOpen, onClose, project, selectedChapter, onProjectUpdated, initialTab = 'overview' }) {
  if (!isOpen || !project) return null;

  const chapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);
  const currentChapter = selectedChapter || chapters[0];

  const [activeTab, setActiveTab] = useState(initialTab); // 'overview' | 'compare' | 'rules' | 'story-qa'
  const [consistencyData, setConsistencyData] = useState(null);
  const [loadingConsistency, setLoadingConsistency] = useState(true);
  const [batchFixing, setBatchFixing] = useState(false);
  const [batchFixSuccessMsg, setBatchFixSuccessMsg] = useState(null);
  const [storyQaData, setStoryQaData] = useState(null);
  const [loadingStoryQa, setLoadingStoryQa] = useState(false);
  const [applyingSafe, setApplyingSafe] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const [compareChapterId, setCompareChapterId] = useState(
    chapters.length > 1 ? (chapters[0]?.id === currentChapter?.id ? chapters[1]?.id : chapters[0]?.id) : null
  );

  const compareChapter = chapters.find(c => c.id === compareChapterId);

  // Extract pronoun pairs from current and compare
  const currentAudit = currentChapter?.pronounAudit || currentChapter?.qaReport?.pronounAudit || {};
  const compareAudit = compareChapter?.pronounAudit || compareChapter?.qaReport?.pronounAudit || {};

  const currentPairs = currentAudit.pronounPairs || [];
  const comparePairs = compareAudit.pronounPairs || [];

  const currentChars = currentAudit.charactersDetected || [];
  const compareChars = compareAudit.charactersDetected || [];

  // Active matrix rules in project
  const matrixRules = project.pronounMatrix || [];

  // Fetch cross-chapter consistency audit
  const fetchStoryQa = async () => {
    setLoadingStoryQa(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/story-qa`);
      if (res.ok) {
        const data = await res.json();
        setStoryQaData(data);
      }
    } catch (e) {
      console.error('Failed to fetch story QA:', e);
    } finally {
      setLoadingStoryQa(false);
    }
  };

  const handleApplyAllSafe = async () => {
    if (applyingSafe) return;
    setApplyingSafe(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/story-qa/apply-all-safe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setBatchFixSuccessMsg(data.message);
        await fetchStoryQa();
        await fetchConsistency();
        if (onProjectUpdated) onProjectUpdated();
      } else {
        alert(data.message || 'Lỗi khi sửa lỗi an toàn');
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setApplyingSafe(false);
    }
  };

  const handleUndoQA = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/batch-replace/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setBatchFixSuccessMsg(data.message);
        await fetchStoryQa();
        await fetchConsistency();
        if (onProjectUpdated) onProjectUpdated();
      } else {
        alert(data.message || 'Lỗi khi hoàn tác');
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    }
  };

  const fetchConsistency = async () => {
    setLoadingConsistency(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/pronoun-consistency`);
      if (res.ok) {
        const data = await res.json();
        setConsistencyData(data);
      }
    } catch (e) {
      console.error('Failed to fetch pronoun consistency:', e);
    } finally {
      setLoadingConsistency(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConsistency();
      fetchStoryQa();
    }
  }, [isOpen, project?.id]);

  // 1-Click Batch Fix Pronouns & Hanzi
  const handleBatchFix = async () => {
    if (batchFixing) return;
    setBatchFixing(true);
    setBatchFixSuccessMsg(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/batch-fix-pronouns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setBatchFixSuccessMsg(data.message || 'Đã chuẩn hóa thành công toàn bộ các chương!');
        await fetchConsistency();
        if (onProjectUpdated) {
          onProjectUpdated();
        }
      } else {
        alert('Lỗi khi chuẩn hóa: ' + (data.message || data.error));
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setBatchFixing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Kiểm Soát Nhất Quán Xưng Hô & Sạch Chữ Hán</h3>
                {consistencyData && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    consistencyData.overallConsistency >= 95
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {consistencyData.overallConsistency}% Nhất Quán
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Tự động quét ma trận đối thoại, triệt tiêu 100% chữ Hán và đồng nhất xưng hô xuyên suốt toàn bộ các chương
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Nhất Quán Toàn Bộ Dự Án ({consistencyData?.totalChaptersAudited || chapters.length} chương)
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'compare'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Đối Chiếu Chi Tiết 2 Chương
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Quy Chuẩn Ma Trận ({matrixRules.length})
          </button>
          <button
            onClick={() => setActiveTab('story-qa')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'story-qa'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <SearchCheck className="w-4 h-4" />
            Trung Tâm QA Toàn Truyện {storyQaData?.totalIssues ? `(${storyQaData.totalIssues})` : ''}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-300">
          
          {/* TAB 1: OVERVIEW TOÀN BỘ DỰ ÁN */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Success Notification */}
              {batchFixSuccessMsg && (
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{batchFixSuccessMsg}</span>
                  </div>
                  <button onClick={() => setBatchFixSuccessMsg(null)} className="text-emerald-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Stats & Batch Action Hero Banner */}
              <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/50 border border-slate-700/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-bold text-sm text-white">Báo Cáo Tự Động Xuyên Suốt Tất Cả Các Chương</h4>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px] max-w-xl">
                    Hệ thống tự động liên kết dữ liệu giữa các chương đã dịch. Nếu phát hiện xưng hô bị lệch (như gọi sai bậc, hay lọt từ hiện đại "tôi"), bạn có thể áp dụng chuẩn hóa 1-click lập tức.
                  </p>
                  <div className="flex items-center gap-4 pt-1 text-[11px]">
                    <span className="text-slate-400">
                      Đã kiểm duyệt: <strong className="text-white">{consistencyData?.totalChaptersAudited || chapters.length}</strong> chương
                    </span>
                    <span className="text-slate-400">
                      Cặp xưng hô đối chiếu: <strong className="text-white">{consistencyData?.totalPairsAudited || 0}</strong> lượt
                    </span>
                    <span className="text-slate-400">
                      Mức độ đồng nhất: <strong className={consistencyData?.overallConsistency >= 95 ? 'text-emerald-400' : 'text-amber-400'}>{consistencyData?.overallConsistency ?? 100}%</strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleBatchFix}
                  disabled={batchFixing}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <Wand2 className={`w-4 h-4 ${batchFixing ? 'animate-spin' : ''}`} />
                  {batchFixing ? 'Đang Chuẩn Hóa...' : '⚡ 1-Click Chuẩn Hóa Toàn Bộ Chương'}
                </button>
              </div>

              {/* Inconsistencies Alert (if any) */}
              {consistencyData?.inconsistencies && consistencyData.inconsistencies.length > 0 ? (
                <div className="space-y-2">
                  <h5 className="font-semibold text-amber-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Phát Hiện {consistencyData.inconsistencies.length} Điểm Cần Chú Ý Trong Bản Dịch:
                  </h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {consistencyData.inconsistencies.map((inc, i) => (
                      <div key={i} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300">#Chương {inc.chapterIndex}: {inc.chapterTitle}</span>
                          <span className="text-[10px] text-amber-400/80">{inc.issue}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 italic font-mono bg-black/20 p-1.5 rounded">
                          "{inc.snippet}"
                        </p>
                        <p className="text-[10px] text-emerald-400 font-medium">
                          Gợi ý khắc phục: {inc.suggestedFix}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Hoàn hảo! Không phát hiện bất kỳ xung đột xưng hô hay chữ Hán nào tồn đọng trong các chương đã dịch.</span>
                </div>
              )}

              {/* Cross-Chapter Matrix Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-white uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" /> Bảng Thống Kê Xưng Hô Thực Tế Qua Các Chương
                  </h5>
                  <button
                    onClick={fetchConsistency}
                    disabled={loadingConsistency}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingConsistency ? 'animate-spin' : ''}`} /> Tải lại
                  </button>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Cặp Giao Tiếp (Người Nói ➔ Nghe)</th>
                        <th className="px-4 py-3">Tự Xưng</th>
                        <th className="px-4 py-3">Gọi Đối Phương</th>
                        <th className="px-4 py-3">Các Chương Có Mặt</th>
                        <th className="px-4 py-3 text-right">Đánh Giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {loadingConsistency ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                            Đang rà soát và đối chiếu xưng hô giữa toàn bộ các chương...
                          </td>
                        </tr>
                      ) : (!consistencyData?.crossChapterMatrix || consistencyData.crossChapterMatrix.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            Chưa ghi nhận đủ dữ liệu đối thoại giữa các chương.
                          </td>
                        </tr>
                      ) : (
                        consistencyData.crossChapterMatrix.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition">
                            <td className="px-4 py-3 font-semibold text-white">
                              {item.speaker} ➔ {item.listener}
                            </td>
                            <td className="px-4 py-3 text-indigo-300 font-medium">
                              "{item.speakerSelf || 'ta'}"
                            </td>
                            <td className="px-4 py-3 text-emerald-300 font-medium">
                              "{item.speakerCallsOther || 'ngươi'}"
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {(item.chapters || []).slice(0, 10).map((chNum, ci) => (
                                  <span key={ci} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                                    #{chNum}
                                  </span>
                                ))}
                                {(item.chapters || []).length > 10 && (
                                  <span className="text-[10px] text-slate-500">+{item.chapters.length - 10} ch</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.isConsistent ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Chuẩn 100%
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Cần rà soát
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ĐỐI CHIẾU 2 CHƯƠNG CHI TIẾT */}
          {activeTab === 'compare' && (
            <div className="space-y-5">
              {/* Chapters to compare selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chapter A */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Chương A (Đang kiểm tra)</span>
                    <span className="text-[11px] font-mono text-slate-400">#Chương {currentChapter?.chapterIndex || currentChapter?.index}</span>
                  </div>
                  <p className="font-semibold text-white text-sm truncate">{currentChapter?.translatedTitle || currentChapter?.title || 'Chưa chọn'}</p>
                  <div className="pt-2 text-[11px] text-slate-400">
                    <span>Nhân vật phát hiện: </span>
                    <span className="text-indigo-300 font-medium">
                      {currentChars.length > 0 ? currentChars.map(c => c.name || c.vi || c.zh).join(', ') : 'Tự động trích xuất'}
                    </span>
                  </div>
                </div>

                {/* Chapter B */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-400 uppercase text-[10px] tracking-wider">Chương B (Đối chiếu)</span>
                    {chapters.length > 1 && (
                      <select
                        value={compareChapterId || ''}
                        onChange={e => setCompareChapterId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-[11px] focus:outline-none"
                      >
                        {chapters.map(ch => (
                          <option key={ch.id} value={ch.id}>
                            Chương {ch.chapterIndex || ch.index}: {(ch.translatedTitle || ch.title).slice(0, 24)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="font-semibold text-white text-sm truncate">{compareChapter?.translatedTitle || compareChapter?.title || 'Chưa có chương đối chiếu'}</p>
                  <div className="pt-2 text-[11px] text-slate-400">
                    <span>Nhân vật phát hiện: </span>
                    <span className="text-indigo-300 font-medium">
                      {compareChars.length > 0 ? compareChars.map(c => c.name || c.vi || c.zh).join(', ') : 'Tự động trích xuất'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pronoun Comparison Table */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" /> Bảng Đối Chiếu Các Cặp Xưng Hô Giữa 2 Chương
                </h4>

                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Người nói ➔ Người nghe</th>
                        <th className="px-4 py-3">Xưng hô ở Chương {currentChapter?.chapterIndex || currentChapter?.index}</th>
                        <th className="px-4 py-3">Xưng hô ở Chương {compareChapter?.chapterIndex || compareChapter?.index || 'B'}</th>
                        <th className="px-4 py-3 text-right">Đánh Giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {currentPairs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                            Chương này chủ yếu là lời dẫn tự sự, chưa phát hiện đối thoại xưng hô đặc biệt.
                          </td>
                        </tr>
                      ) : (
                        currentPairs.map((pair, idx) => {
                          const matchedInB = comparePairs.find(p => p.speaker === pair.speaker && p.listener === pair.listener);
                          const isConsistent = !matchedInB || (
                            matchedInB.speakerSelf === pair.speakerSelf &&
                            matchedInB.speakerCallsOther === pair.speakerCallsOther
                          );

                          return (
                            <tr key={idx} className="hover:bg-slate-800/30 transition">
                              <td className="px-4 py-3 font-semibold text-white">
                                {pair.speaker} ➔ {pair.listener}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-indigo-300 font-medium">"{pair.speakerSelf}"</span> gọi <span className="text-emerald-300 font-medium">"{pair.speakerCallsOther}"</span>
                              </td>
                              <td className="px-4 py-3">
                                {matchedInB ? (
                                  <span>
                                    <span className="text-indigo-300 font-medium">"{matchedInB.speakerSelf}"</span> gọi <span className="text-emerald-300 font-medium">"{matchedInB.speakerCallsOther}"</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">Không xuất hiện đối thoại ở chương B</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {isConsistent ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Nhất quán 100%
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Cần chú ý
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRUNG TÂM QA TOÀN TRUYỆN */}
          {activeTab === 'story-qa' && (
            <div className="space-y-5">
              {/* Action Banner */}
              <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/50 border border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SearchCheck className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-bold text-sm text-white">Quét & Tổng Hợp Lỗi Toàn Bộ Các Chương</h4>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Phát hiện tổng cộng <strong className="text-white">{storyQaData?.totalIssues || 0}</strong> lỗi/nghi vấn trong <strong className="text-white">{storyQaData?.totalChapters || chapters.length}</strong> chương.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {storyQaData?.canUndo && (
                    <button
                      onClick={handleUndoQA}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác QA
                    </button>
                  )}
                  <button
                    onClick={handleApplyAllSafe}
                    disabled={applyingSafe}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 ${applyingSafe ? 'animate-spin' : ''}`} />
                    {applyingSafe ? 'Đang sửa...' : '⚡ Sửa Tất Cả Lỗi An Toàn'}
                  </button>
                </div>
              </div>

              {/* Groups List */}
              <div className="space-y-3">
                {loadingStoryQa ? (
                  <div className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Đang quét và gom nhóm lỗi toàn bộ các chương...
                  </div>
                ) : (!storyQaData?.groups || storyQaData.groups.length === 0) ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-emerald-300">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                    Bản dịch toàn bộ truyện hoàn toàn sạch sẽ, không còn lỗi nào!
                  </div>
                ) : (
                  storyQaData.groups.map((group, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            group.severity === 'critical' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          }`}>
                            {group.title || group.type}
                          </span>
                          <span className="text-white font-semibold text-xs truncate max-w-sm">"{group.value}"</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Xuất hiện <strong className="text-amber-400">{group.count}</strong> lần · <strong className="text-indigo-300">{group.chapterCount}</strong> chương
                        </span>
                      </div>

                      {group.instruction && (
                        <p className="text-[11px] text-slate-400 italic bg-black/20 p-2 rounded">
                          {group.instruction} {group.replacement ? <span>➔ Gợi ý: <strong className="text-emerald-400">"{group.replacement}"</strong></span> : null}
                        </p>
                      )}

                      {group.locations && group.locations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {group.locations.map((loc, li) => (
                            <span key={li} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300">
                              #Chương {loc.chapterIndex}: {loc.chapterTitle.slice(0, 15)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUY TẮC MA TRẬN */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h5 className="font-semibold text-white">Ma Trận Xưng Hô Dự Án Đang Lưu Trữ ({matrixRules.length} quy tắc)</h5>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Các quy tắc này được tự động học qua từng chương và truyền liên tục vào prompt của AI khi dịch các chương tiếp theo để đảm bảo tính nhất quán tuyệt đối.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matrixRules.map((rule, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">
                        {rule.speakerVi || rule.speakerZh} ➔ {rule.listenerVi || rule.listenerZh}
                      </span>
                      {rule.relationship && (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px]">
                          {rule.relationship}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Tự xưng: <span className="text-amber-400 font-semibold">"{rule.speakerCallsSelf}"</span> | Gọi đối phương: <span className="text-emerald-400 font-semibold">"{rule.speakerCallsListener}"</span>
                    </div>
                    {rule.notes && (
                      <p className="text-[10px] text-slate-500 italic">{rule.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex justify-between items-center">
          <div className="text-[11px] text-slate-400">
            Tổng cộng: <strong className="text-white">{chapters.length}</strong> chương đã hoàn thành
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
