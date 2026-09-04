import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Users, CheckCircle2, ArrowRight, X, RefreshCw, Sparkles } from 'lucide-react';

export default function PronounInspectorModal({ isOpen, onClose, project, selectedChapter }) {
  if (!isOpen || !project) return null;

  const chapters = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText);
  const currentChapter = selectedChapter || chapters[0];

  const [compareChapterId, setCompareChapterId] = useState(
    chapters.length > 1 ? (chapters[0].id === currentChapter?.id ? chapters[1].id : chapters[0].id) : null
  );

  const compareChapter = chapters.find(c => c.id === compareChapterId);

  // Extract pronoun pairs from current and compare
  const currentPairs = currentChapter?.pronounAudit?.pronounPairs || [];
  const comparePairs = compareChapter?.pronounAudit?.pronounPairs || [];

  const currentChars = currentChapter?.pronounAudit?.charactersDetected || [];
  const compareChars = compareChapter?.pronounAudit?.charactersDetected || [];

  // Active matrix rules in project
  const matrixRules = project.pronounMatrix || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Thanh Tra & Kiểm Soát Nhất Quán Xưng Hô</h3>
              <p className="text-xs text-slate-400">
                Hệ thống tự động quét và đối chiếu cách xưng hô giữa các chương để đảm bảo đồng nhất 100%
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-300">
          {/* Explanation Banner */}
          <div className="p-4 bg-gradient-to-r from-indigo-950/40 to-slate-950/60 border border-indigo-500/20 rounded-xl flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-white">Làm sao biết truyện đã đồng nhất xưng hô khi chưa từng đọc?</p>
              <p className="text-slate-400 leading-relaxed">
                Sau mỗi chương, AI sẽ <strong>tự động đọc và trích xuất danh tính nhân vật cùng các cặp xưng hô thực tế</strong> xuất hiện trong lời thoại. Dữ liệu này được tự động cập nhật vào Ma Trận Chung và truyền tiếp cho chương sau, loại bỏ hoàn toàn việc phải đoán trước hoặc đọc trước truyện.
              </p>
            </div>
          </div>

          {/* Chapters to compare selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chapter A */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Chương A (Đang kiểm tra)</span>
                <span className="text-[11px] font-mono text-slate-400">#Chương {currentChapter?.index}</span>
              </div>
              <p className="font-semibold text-white text-sm truncate">{currentChapter?.title || 'Chưa chọn'}</p>
              <div className="pt-2 text-[11px] text-slate-400">
                <span>Nhân vật phát hiện: </span>
                <span className="text-indigo-300 font-medium">
                  {currentChars.length > 0 ? currentChars.map(c => c.vi || c.zh).join(', ') : 'Tự động trích xuất'}
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
                      <option key={ch.id} value={ch.id}>Chương {ch.index}: {ch.title.slice(0, 20)}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="font-semibold text-white text-sm truncate">{compareChapter?.title || 'Chưa có chương đối chiếu'}</p>
              <div className="pt-2 text-[11px] text-slate-400">
                <span>Nhân vật phát hiện: </span>
                <span className="text-indigo-300 font-medium">
                  {compareChars.length > 0 ? compareChars.map(c => c.vi || c.zh).join(', ') : 'Tự động trích xuất'}
                </span>
              </div>
            </div>
          </div>

          {/* Pronoun Comparison Table */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Bảng Đối Chiếu Các Cặp Xưng Hô Tự Động Ghi Nhận
            </h4>

            <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Người nói ➔ Người nghe</th>
                    <th className="px-4 py-3">Xưng hô ở Chương {currentChapter?.index}</th>
                    <th className="px-4 py-3">Xưng hô ở Chương {compareChapter?.index || 'B'}</th>
                    <th className="px-4 py-3 text-right">Đánh Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentPairs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Chương này chủ yếu là lời dẫn hoặc đối thoại nội tâm, chưa phát hiện xung đột xưng hô nào.
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
                              <span className="text-slate-500 italic">Không xuất hiện đối thoại</span>
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

          {/* Active Knowledge Graph in Project */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Trí nhớ ma trận đã tự động tích lũy trong dự án:
            </span>
            <div className="flex flex-wrap gap-2">
              {project.characters && project.characters.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-semibold text-indigo-400">{c.vi || c.zh}</span> ({c.role || c.gender || 'Nhân vật'})
                </span>
              ))}
              {(!project.characters || project.characters.length === 0) && (
                <span className="text-slate-500 text-xs italic">Sẽ tự động điền khi các chương được dịch xong.</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
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
