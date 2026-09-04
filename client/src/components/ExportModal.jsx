import React, { useState } from 'react';
import { Download, FileText, Archive, BookOpen, FileCode, X, Loader2 } from 'lucide-react';
import { exportProject } from '../services/browserExport';

export default function ExportModal({ isOpen, onClose, project }) {
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  if (!isOpen || !project) return null;

  const completedCount = (project.chapters || []).filter(c => c.status === 'completed' || c.translatedText).length;

  const handleDownload = async (format) => {
    setExporting(format);
    setError('');
    try {
      await exportProject(project, format);
    } catch (err) {
      setError(err.message || 'Không thể tạo file xuất.');
    } finally {
      setExporting('');
    }
  };

  const exportFormats = [
    {
      id: 'txt',
      title: 'File TXT Gộp Toàn Bộ',
      desc: 'Một file text duy nhất chứa toàn bộ các chương đã dịch, kèm tiêu đề phân cách rõ ràng.',
      icon: FileText,
      color: 'from-blue-600 to-cyan-600',
      badge: '.txt'
    },
    {
      id: 'zip',
      title: 'File Nén ZIP (Từng chương rời)',
      desc: 'Gói nén chứa từng file .txt riêng biệt cho từng chương (0001_Chuong_1.txt, v.v.).',
      icon: Archive,
      color: 'from-amber-600 to-orange-600',
      badge: '.zip'
    },
    {
      id: 'epub',
      title: 'Sách Điện Tử EPUB Chuẩn',
      desc: 'File sách điện tử kèm mục lục đầy đủ, sẵn sàng đọc trên điện thoại, máy đọc sách Kindle/Kobo/Moon+ Reader.',
      icon: BookOpen,
      color: 'from-emerald-600 to-teal-600',
      badge: '.epub'
    },
    {
      id: 'docx',
      title: 'Tài Liệu Word Microsoft',
      desc: 'File DOCX trình bày chuẩn Heading 1 cho tiêu đề chương và căn lề đoạn văn chuyên nghiệp.',
      icon: FileCode,
      color: 'from-indigo-600 to-purple-600',
      badge: '.docx'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Xuất Bản & Tải Về Truyện</h3>
              <p className="text-xs text-slate-400">
                Truyện: <span className="text-indigo-400 font-medium">{project.title}</span> ({completedCount} chương đã dịch)
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
        <div className="p-6 space-y-4 text-slate-300">
          {completedCount === 0 ? (
            <div className="p-5 bg-amber-950/30 border border-amber-800/50 rounded-xl text-center">
              <p className="text-amber-300 font-medium text-sm">Chưa có chương nào được dịch hoàn tất!</p>
              <p className="text-xs text-slate-400 mt-1">
                Vui lòng dịch ít nhất 1 chương trong tab "Danh Sách Chương" trước khi xuất file.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {exportFormats.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between transition group"
                  >
                    <div className="flex items-start gap-3.5 pr-4">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-md shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-white group-hover:text-indigo-300 transition">
                            {item.title}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownload(item.id)}
                      disabled={Boolean(exporting)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-indigo-600/20"
                    >
                      {exporting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {exporting === item.id ? 'Đang tạo...' : 'Tải về'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-xs text-red-300">{error}</p>}

          {/* Export Glossary Button */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Bạn muốn lưu từ điển để tái sử dụng cho truyện khác?</span>
            <a
              href={`/api/projects/${project.id}/export-vietphrase`}
              download
              className="text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              Tải Từ Điển (Names.txt)
            </a>
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
