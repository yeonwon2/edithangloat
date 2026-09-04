import React, { useState, useEffect } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Settings2, Sparkles, Layers } from 'lucide-react';

function previewChapters(text, splitMode, customPattern) {
  if (!text || !text.trim()) return [];
  if (splitMode === 'single') {
    const lines = text.trim().split('\n');
    return [{ title: lines[0].slice(0, 60) || 'Chương 1' }];
  }
  let regex;
  if (splitMode === 'custom' && customPattern.trim()) {
    const pat = customPattern.trim();
    if (pat.includes('*')) {
      const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[0-9一二三四五六七八九十百千万零两\\s]+');
      regex = new RegExp(`(?:^|\\n)[\\s\\u3000]*(${escaped}[^\\n]*)`, 'gi');
    } else {
      const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(`(?:^|\\n)[\\s\\u3000]*(${escaped}[^\\n]*)`, 'gi');
    }
  } else {
    regex = /(?:^|\n)[\s\u3000]*(【?\s*(?:第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节卷集部]|(?:Chương|Hồi|Tiết|Quyển|Tập|Chapter|Chap)\s*[0-9一二三四五六七八九十百千万零两]+|={3,}[^=\n]+={3,}|-{3,}[^-\n]+-{3,}|\*{3,}[^*\n]+\*{3,}|(?:(?:\(|\[)?[0-9]{1,4}(?:\)|\]|\.|\、)\s*[^，。\n]{2,30}))\s*】?[^\n]*)/gi;
  }
  const titles = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    titles.push({ title: m[1].trim() });
  }
  return titles;
}

export default function ImportModal({ isOpen, onClose, project, onImportSuccess }) {
  const [activeMode, setActiveMode] = useState('upload'); // 'upload' | 'paste'
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [filePreviewText, setFilePreviewText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [splitMode, setSplitMode] = useState('auto'); // 'auto' | 'custom' | 'single'
  const [customPattern, setCustomPattern] = useState('');

  if (!isOpen || !project) return null;

  // If text file selected, read preview text
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setFilePreviewText('');
    if (f && (f.name.endsWith('.txt') || f.name.endsWith('.md'))) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setFilePreviewText(evt.target.result || '');
      };
      reader.readAsText(f.slice(0, 300000)); // preview first 300KB
    }
  };

  const currentPreviewSource = activeMode === 'paste' ? pastedText : filePreviewText;
  const detectedChapters = previewChapters(currentPreviewSource, splitMode, customPattern);

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
          singleChapter: splitMode === 'single',
          customPattern: splitMode === 'custom' ? customPattern : ''
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
      formData.append('singleChapter', String(splitMode === 'single'));
      if (splitMode === 'custom') {
        formData.append('customPattern', customPattern);
      }

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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
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
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 px-6 pt-3 bg-slate-950/30 gap-4">
          <button
            onClick={() => setActiveMode('upload')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeMode === 'upload' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" /> Tải Lên File (.docx, .txt, .epub...)
          </button>
          <button
            onClick={() => setActiveMode('paste')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeMode === 'paste' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" /> Dán Văn Bản Trực Tiếp
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Split Mode Options */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-indigo-400" /> Chế độ phân tách chương:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                onClick={() => setSplitMode('auto')}
                className={`p-2.5 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                  splitMode === 'auto'
                    ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitMode === 'auto'}
                    onChange={() => setSplitMode('auto')}
                    className="text-indigo-600"
                  />
                  <span className="font-semibold text-xs">Tự động nhận diện</span>
                </div>
                <span className="text-[10px] text-slate-400 pl-5">
                  第X章, Chương X, 1. , 1、, 【X】...
                </span>
              </label>

              <label
                onClick={() => setSplitMode('custom')}
                className={`p-2.5 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                  splitMode === 'custom'
                    ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitMode === 'custom'}
                    onChange={() => setSplitMode('custom')}
                    className="text-indigo-600"
                  />
                  <span className="font-semibold text-xs text-amber-400">Từ khóa tùy ý</span>
                </div>
                <span className="text-[10px] text-slate-400 pl-5">
                  Tách theo từ khóa bạn gõ
                </span>
              </label>

              <label
                onClick={() => setSplitMode('single')}
                className={`p-2.5 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                  splitMode === 'single'
                    ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitMode === 'single'}
                    onChange={() => setSplitMode('single')}
                    className="text-indigo-600"
                  />
                  <span className="font-semibold text-xs">Giữ 1 chương</span>
                </div>
                <span className="text-[10px] text-slate-400 pl-5">
                  Không bóc tách, giữ nguyên
                </span>
              </label>
            </div>

            {/* Custom pattern input if custom mode selected */}
            {splitMode === 'custom' && (
              <div className="p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-amber-300">
                    Nhập từ khóa bắt đầu mỗi chương:
                  </label>
                  <span className="text-[10px] text-slate-500">Hỗ trợ dấu * (ví dụ: 第*章)</span>
                </div>
                <input
                  type="text"
                  value={customPattern}
                  onChange={e => setCustomPattern(e.target.value)}
                  placeholder="Ví dụ: 第*章 hoặc Chương hoặc === hoặc 1. hoặc Hồi..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  autoFocus
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500">Gợi ý nhanh:</span>
                  {['第*章', 'Chương', 'Chapter', '===', '---', 'Hồi *', '【第*章】'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCustomPattern(p)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Preview Bar */}
            {currentPreviewSource && (
              <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Xem trước kết quả phân tách:
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    detectedChapters.length > 1
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {detectedChapters.length > 0 ? `Nhận diện ${detectedChapters.length} chương` : 'Chưa nhận diện được'}
                  </span>
                </div>
                {detectedChapters.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
                    {detectedChapters.slice(0, 10).map((c, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800 text-indigo-300 rounded border border-slate-700 truncate max-w-[200px]">
                        {c.title}
                      </span>
                    ))}
                    {detectedChapters.length > 10 && (
                      <span className="text-[10px] text-slate-500 self-center">
                        +{detectedChapters.length - 10} chương nữa...
                      </span>
                    )}
                  </div>
                )}
                {detectedChapters.length === 1 && splitMode === 'auto' && (
                  <p className="text-[10px] text-amber-400/90 mt-1.5 leading-relaxed">
                    💡 <em>Nếu file có 2 chương trở lên nhưng hệ thống chỉ nhận 1 chương, hãy bấm chọn <strong>"Từ khóa tùy ý"</strong> bên trên và gõ từ khóa (như <code>第*章</code> hoặc <code>Chương</code>) để hệ thống cắt chính xác!</em>
                  </p>
                )}
              </div>
            )}
          </div>

          {activeMode === 'upload' ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-2xl p-8 text-center transition bg-slate-950/40 cursor-pointer relative">
                <input
                  type="file"
                  accept=".txt,.docx,.doc,.epub,.pdf,.zip"
                  onChange={handleFileChange}
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
