import React, { useState } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ImportModal({ isOpen, onClose, project, onImportSuccess }) {
  const [activeMode, setActiveMode] = useState('upload'); // 'upload' | 'paste'
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [singleChapter, setSingleChapter] = useState(false);

  if (!isOpen || !project) return null;

  const handleImportPaste = async () => {
    if (!pastedText.trim()) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/import-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pastedText,
          singleChapter
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult({ success: true, count: data.count });
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1000);
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('singleChapter', String(singleChapter));

      const res = await fetch(`/api/projects/${project.id}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult({ success: true, count: data.count });
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1000);
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Nạp Truyện / Thêm Chương Mới</h3>
              <p className="text-xs text-slate-400">Tự động nhận diện và bóc tách chương thông minh (第X章, Chương X...)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 px-6 pt-3 bg-slate-950/30 gap-4">
          <button
            onClick={() => setActiveMode('upload')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeMode === 'upload' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" /> Tải Lên File .TXT
          </button>
          <button
            onClick={() => setActiveMode('paste')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeMode === 'paste' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" /> Dán Văn Bản Trực Tiếp
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Split Mode Toggle */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Chế độ phân chia chương:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="radio"
                  name="modalSplitMode"
                  checked={!singleChapter}
                  onChange={() => setSingleChapter(false)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Tự bóc tách (第X章/Chương X)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="radio"
                  name="modalSplitMode"
                  checked={singleChapter}
                  onChange={() => setSingleChapter(true)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-amber-400 font-semibold">Giữ nguyên làm 1 chương</span>
              </label>
            </div>
          </div>

          {activeMode === 'upload' ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-2xl p-8 text-center transition bg-slate-950/40 cursor-pointer relative">
                <input
                  type="file"
                  accept=".txt,.docx,.doc,.epub,.pdf,.zip"
                  onChange={e => setFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileText className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-200">
                  {file ? file.name : 'Nhấp hoặc Kéo thả file (.txt, .docx, .epub, .pdf, .zip) vào đây'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Hỗ trợ đầy đủ: TXT, Word (.docx), Sách điện tử (.epub), PDF, ZIP (lên tới 100MB)</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleImportFile}
                  disabled={!file || importing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
                >
                  <Upload className="w-4 h-4" /> {importing ? 'Đang trích xuất & bóc chương...' : 'Bắt Đầu Nạp File'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                rows={10}
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Dán toàn bộ văn bản tiểu thuyết hoặc 1 chương vào đây..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 text-xs font-sans focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 leading-relaxed"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-slate-500 font-mono">
                  {pastedText.length} ký tự
                </span>
                <button
                  onClick={handleImportPaste}
                  disabled={!pastedText.trim() || importing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
                >
                  <Upload className="w-4 h-4" /> {importing ? 'Đang nạp...' : 'Thêm Vào Hàng Đợi'}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              result.success
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-red-950/40 border-red-800 text-red-300'
            }`}>
              {result.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Thành công! Đã tìm thấy và thêm {result.count} chương mới vào dự án.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{result.message}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
