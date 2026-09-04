import React, { useState } from 'react';
import { Sparkles, Users, MessageSquare, BookMarked, Upload, Plus, Trash2, Save, Download, HelpCircle } from 'lucide-react';

export default function GlossaryManager({ project, onUpdateProject }) {
  const [activeSubTab, setActiveSubTab] = useState('characters'); // 'characters' | 'pronouns' | 'terms' | 'import'
  const [scanning, setScanning] = useState(false);
  const [vietphraseText, setVietphraseText] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  // New character form
  const [newChar, setNewChar] = useState({ zh: '', vi: '', gender: 'Nữ', narrativePronoun: 'cô', role: '', notes: '' });
  // New pronoun rule form
  const [newPronoun, setNewPronoun] = useState({
    speakerZh: '',
    listenerZh: '',
    speakerCallsSelf: 'ta',
    speakerCallsListener: 'ngươi',
    notes: ''
  });
  // New term form
  const [newTerm, setNewTerm] = useState({ zh: '', vi: '', category: 'Cảnh giới' });

  const characters = project?.characters || [];
  const pronounMatrix = project?.pronounMatrix || [];
  const terms = project?.terms || [];

  const handleAutoScan = async (scanMode = 'all') => {
    if (!project.chapters || project.chapters.length === 0) {
      alert('Vui lòng thêm ít nhất 1 chương truyện trước để AI có văn bản phân tích!');
      return;
    }
    setScanning(true);
    setStatusMsg({
      type: 'info',
      text: scanMode === 'all'
        ? 'Gemini đang quét sâu đa phân đoạn qua toàn bộ các chương để trích xuất nhân vật và ma trận xưng hô...'
        : 'Gemini đang đọc các chương gần nhất để bổ sung nhân vật...'
    });
    try {
      const res = await fetch(`/api/projects/${project.id}/auto-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanMode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi quét tự động');

      onUpdateProject(data.project);
      setStatusMsg({
        type: 'success',
        text: `Quét thành công! Đã thêm: ${data.added.characters} nhân vật mới, ${data.added.pronounMatrix} quy tắc xưng hô mới, ${data.added.terms} thuật ngữ.`
      });
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message });
    } finally {
      setScanning(false);
    }
  };

  const handleAddCharacter = async () => {
    if (!newChar.zh.trim() || !newChar.vi.trim()) return;
    const updated = [
      ...characters,
      { id: `char_${Date.now()}`, ...newChar }
    ];
    onUpdateProject({ ...project, characters: updated });
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: updated })
    });
    setNewChar({ zh: '', vi: '', gender: 'Nữ', narrativePronoun: 'cô', role: '', notes: '' });
  };

  const handleUpdateCharNarrative = async (charId, narrativePronoun) => {
    const updated = characters.map(c => c.id === charId ? { ...c, narrativePronoun } : c);
    onUpdateProject({ ...project, characters: updated });
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: updated })
    });
  };

  const handleDeleteCharacter = async (id) => {
    const updated = characters.filter(c => c.id !== id);
    onUpdateProject({ ...project, characters: updated });
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: updated })
    });
  };

  const handleAddPronounRule = () => {
    if (!newPronoun.speakerZh.trim() || !newPronoun.listenerZh.trim()) return;
    const updated = [
      ...pronounMatrix,
      { id: `pronoun_${Date.now()}`, ...newPronoun }
    ];
    onUpdateProject({ ...project, pronounMatrix: updated });
    setNewPronoun({
      speakerZh: '',
      listenerZh: '',
      speakerCallsSelf: 'ta',
      speakerCallsListener: 'ngươi',
      notes: ''
    });
  };

  const handleDeletePronounRule = (id) => {
    const updated = pronounMatrix.filter(p => p.id !== id);
    onUpdateProject({ ...project, pronounMatrix: updated });
  };

  const handleAddTerm = () => {
    if (!newTerm.zh.trim() || !newTerm.vi.trim()) return;
    const updated = [
      ...terms,
      { id: `term_${Date.now()}`, ...newTerm }
    ];
    onUpdateProject({ ...project, terms: updated });
    setNewTerm({ zh: '', vi: '', category: 'Cảnh giới' });
  };

  const handleDeleteTerm = (id) => {
    const updated = terms.filter(t => t.id !== id);
    onUpdateProject({ ...project, terms: updated });
  };

  const handleImportVietphrase = async () => {
    if (!vietphraseText.trim()) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/import-vietphrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: vietphraseText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onUpdateProject({ ...project, terms: data.terms });
      setVietphraseText('');
      setStatusMsg({ type: 'success', text: `Đã nạp thành công ${data.importedCount} từ khóa Vietphrase!` });
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with AI Scan Button */}
      <div className="p-5 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/80 border border-indigo-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Ma Trận Xưng Hô & Từ Điển Thông Minh</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
              <span>●</span> Tự Động Học Khi Dịch: BẬT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            AI tự động đưa các quy tắc xưng hô này vào từng chương dịch. Khi dịch qua các chương tiếp theo, hệ thống sẽ <strong>tự động phát hiện và học thêm</strong> các nhân vật và cặp xưng hô mới.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAutoScan('all')}
            disabled={scanning}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition shrink-0 cursor-pointer"
            title="Quét đa phân đoạn qua toàn bộ các chương để bắt trọn bộ nhân vật và ma trận xưng hô của cả truyện"
          >
            <Sparkles className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Đang phân tích...' : '🌌 Quét Sâu Toàn Bộ Truyện'}</span>
          </button>

          <button
            onClick={() => handleAutoScan('recent')}
            disabled={scanning}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            title="Chỉ quét các chương gần nhất để bổ sung nhân vật mới"
          >
            <span>⚡ Quét Chương Gần Nhất</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          statusMsg.type === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' :
          statusMsg.type === 'error' ? 'bg-red-950/40 border-red-800 text-red-300' :
          'bg-indigo-950/40 border-indigo-800 text-indigo-300'
        }`}>
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('characters')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'characters'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" /> Danh Sách Nhân Vật ({characters.length})
        </button>

        <button
          onClick={() => setActiveSubTab('pronouns')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'pronouns'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Quy Tắc Xưng Hô Đôi ({pronounMatrix.length})
        </button>

        <button
          onClick={() => setActiveSubTab('terms')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'terms'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BookMarked className="w-4 h-4" /> Thuật Ngữ / Cảnh Giới ({terms.length})
        </button>

        <button
          onClick={() => setActiveSubTab('import')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'import'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Upload className="w-4 h-4" /> Nạp Vietphrase (Names.txt)
        </button>
      </div>

      {/* Subtab 1: Characters */}
      {activeSubTab === 'characters' && (
        <div className="space-y-4">
          {/* Add Character Input Form */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Tên Trung (Raw)</label>
              <input
                type="text"
                value={newChar.zh}
                onChange={e => setNewChar({ ...newChar, zh: e.target.value })}
                placeholder="盛青衫"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Tên Hán Việt</label>
              <input
                type="text"
                value={newChar.vi}
                onChange={e => setNewChar({ ...newChar, vi: e.target.value })}
                placeholder="Thịnh Thanh Sơn"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Giới tính</label>
              <select
                value={newChar.gender}
                onChange={e => setNewChar({ ...newChar, gender: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Nữ">Nữ</option>
                <option value="Nam">Nam</option>
                <option value="Khác/Chưa rõ">Khác</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-amber-300 font-semibold">Ngôi Lời Dẫn</label>
              <input
                type="text"
                list="narrative-options"
                value={newChar.narrativePronoun || 'cô'}
                onChange={e => setNewChar({ ...newChar, narrativePronoun: e.target.value.trim() })}
                placeholder="cô/nàng/nó..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-semibold focus:outline-none focus:border-indigo-500"
              />
              <datalist id="narrative-options">
                <option value="cô" />
                <option value="nàng" />
                <option value="nó" />
                <option value="người máy" />
                <option value="con robot" />
                <option value="hắn" />
                <option value="y" />
                <option value="chàng" />
                <option value="bé" />
                <option value="ông ta" />
                <option value="bà ta" />
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Thân phận / Vai vế</label>
              <input
                type="text"
                value={newChar.role}
                onChange={e => setNewChar({ ...newChar, role: e.target.value })}
                placeholder="Nhân vật chính / Alpha..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Ghi chú</label>
              <input
                type="text"
                value={newChar.notes}
                onChange={e => setNewChar({ ...newChar, notes: e.target.value })}
                placeholder="Lưu ý quan hệ"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleAddCharacter}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition h-[34px]"
            >
              <Plus className="w-4 h-4" /> Thêm
            </button>
          </div>

          {/* Characters Table */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tên Trung</th>
                  <th className="px-4 py-3">Tên Hán Việt</th>
                  <th className="px-4 py-3">Giới tính</th>
                  <th className="px-4 py-3 text-amber-300">Ngôi Lời Dẫn (Tự do nhập)</th>
                  <th className="px-4 py-3">Thân phận</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {characters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Chưa có nhân vật nào. Bấm "AI Quét Tự Động" hoặc thêm thủ công ở trên.
                    </td>
                  </tr>
                ) : (
                  characters.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-amber-300">{c.zh}</td>
                      <td className="px-4 py-3 font-semibold text-white">{c.vi}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${c.gender === 'Nữ' ? 'bg-pink-500/10 text-pink-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {c.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          list="narrative-options"
                          value={c.narrativePronoun || (c.gender === 'Nữ' ? 'nàng' : 'hắn')}
                          onChange={e => handleUpdateCharNarrative(c.id, e.target.value.trim())}
                          placeholder="cô/nàng/nó..."
                          className="bg-slate-900 border border-slate-700 text-amber-300 font-semibold rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 w-24 hover:border-amber-400/50 transition"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-400">{c.role || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{c.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteCharacter(c.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Pronoun Matrix */}
      {activeSubTab === 'pronouns' && (
        <div className="space-y-4">
          {/* Add Pronoun Form */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Người nói (Tên Trung/Việt)</label>
              <input
                type="text"
                value={newPronoun.speakerZh}
                onChange={e => setNewPronoun({ ...newPronoun, speakerZh: e.target.value })}
                placeholder="萧炎 (Tiêu Viêm)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Nói với ai</label>
              <input
                type="text"
                value={newPronoun.listenerZh}
                onChange={e => setNewPronoun({ ...newPronoun, listenerZh: e.target.value })}
                placeholder="药老 (Dược Lão)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Người nói tự xưng là</label>
              <input
                type="text"
                value={newPronoun.speakerCallsSelf}
                onChange={e => setNewPronoun({ ...newPronoun, speakerCallsSelf: e.target.value })}
                placeholder="đồ nhi / đệ tử / ta..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Gọi đối phương là</label>
              <input
                type="text"
                value={newPronoun.speakerCallsListener}
                onChange={e => setNewPronoun({ ...newPronoun, speakerCallsListener: e.target.value })}
                placeholder="sư phụ / lão sư / ngươi..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Thái độ / Ngữ cảnh</label>
              <input
                type="text"
                value={newPronoun.notes}
                onChange={e => setNewPronoun({ ...newPronoun, notes: e.target.value })}
                placeholder="Kính trọng, thân thiết"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleAddPronounRule}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition h-[34px]"
            >
              <Plus className="w-4 h-4" /> Thêm Quy Tắc
            </button>
          </div>

          {/* Pronoun Table */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Người nói</th>
                  <th className="px-4 py-3">Người nghe</th>
                  <th className="px-4 py-3">Người nói tự xưng</th>
                  <th className="px-4 py-3">Gọi người nghe</th>
                  <th className="px-4 py-3">Thái độ</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pronounMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Chưa có quy tắc xưng hô nào. Thêm quy tắc để AI luôn tuân thủ 100%!
                    </td>
                  </tr>
                ) : (
                  pronounMatrix.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-white">{p.speakerZh}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">➔ {p.listenerZh}</td>
                      <td className="px-4 py-3 font-bold text-indigo-400">"{p.speakerCallsSelf}"</td>
                      <td className="px-4 py-3 font-bold text-emerald-400">"{p.speakerCallsListener}"</td>
                      <td className="px-4 py-3 text-slate-400">{p.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeletePronounRule(p.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Terms */}
      {activeSubTab === 'terms' && (
        <div className="space-y-4">
          {/* Add Term Form */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Từ gốc tiếng Trung</label>
              <input
                type="text"
                value={newTerm.zh}
                onChange={e => setNewTerm({ ...newTerm, zh: e.target.value })}
                placeholder="斗气 / 筑基期 / 云岚宗"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Bản dịch tiếng Việt chuẩn</label>
              <input
                type="text"
                value={newTerm.vi}
                onChange={e => setNewTerm({ ...newTerm, vi: e.target.value })}
                placeholder="Đấu Khí / Trúc Cơ Kỳ / Vân Lam Tông"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Phân loại</label>
              <select
                value={newTerm.category}
                onChange={e => setNewTerm({ ...newTerm, category: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Cảnh giới">Cảnh giới tu luyện</option>
                <option value="Tông môn">Tông môn / Thế lực</option>
                <option value="Công pháp">Công pháp / Chiêu thức</option>
                <option value="Pháp bảo">Pháp bảo / Đan dược</option>
                <option value="Địa danh">Địa danh</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <button
              onClick={handleAddTerm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition h-[34px]"
            >
              <Plus className="w-4 h-4" /> Thêm Thuật Ngữ
            </button>
          </div>

          {/* Terms Table */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3">Từ gốc Trung</th>
                  <th className="px-4 py-3">Dịch Tiếng Việt</th>
                  <th className="px-4 py-3">Phân loại</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {terms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Chưa có thuật ngữ nào.
                    </td>
                  </tr>
                ) : (
                  terms.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-amber-300">{t.zh}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">{t.vi}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteTerm(t.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 4: Import Vietphrase */}
      {activeSubTab === 'import' && (
        <div className="space-y-4 p-5 bg-slate-950/60 border border-slate-800 rounded-2xl">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" /> Nạp file Names.txt / Vietphrase
            </h4>
            <p className="text-xs text-slate-400">
              Dán nội dung từ điển theo định dạng <code className="text-amber-300 font-mono">TừTrung=TừViệt</code> hoặc <code className="text-amber-300 font-mono">TừTrung=TừViệt#Ghi chú</code> (Hỗ trợ định dạng của phần mềm QuickTranslator / Vietphrase).
            </p>
          </div>

          <textarea
            rows={8}
            value={vietphraseText}
            onChange={e => setVietphraseText(e.target.value)}
            placeholder="萧炎=Tiêu Viêm&#10;药老=Dược Lão#Sư phụ&#10;斗气=Đấu Khí#Tu luyện&#10;乌坦城=Ô Thản Thành#Địa danh"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Mỗi dòng một từ khóa</span>
            <button
              onClick={handleImportVietphrase}
              disabled={!vietphraseText.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
            >
              <Upload className="w-4 h-4" /> Nạp Vào Từ Điển
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
