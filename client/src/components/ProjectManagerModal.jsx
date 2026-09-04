import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  BookOpen,
  FolderOpen,
  Sparkles,
  Layers,
  Calendar,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function ProjectManagerModal({
  isOpen,
  onClose,
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject
}) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Tiên Hiệp / Huyền Huyễn');
  const [model, setModel] = useState('gemini-3.6-flash');
  const [toneGuidance, setToneGuidance] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      await onCreateProject({
        title: title.trim(),
        genre,
        model,
        toneGuidance: toneGuidance.trim()
      });
      setTitle('');
      setToneGuidance('');
      setActiveTab('list');
      onClose();
    } catch (err) {
      alert('Lỗi tạo truyện: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.genre || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Quản Lý Dự Án Dịch Truyện
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {projects.length} bộ truyện
                </span>
              </h2>
              <p className="text-xs text-slate-400">Tạo mới, chuyển đổi hoặc xóa các bộ truyện của bạn trên Cloudflare D1</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls & Search */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Danh Sách Truyện ({projects.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Tạo Truyện Mới
            </button>
          </div>

          {activeTab === 'list' && projects.length > 3 && (
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm tên truyện..."
              className="w-full sm:w-56 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'list' ? (
            filteredProjects.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto border border-slate-700">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-300">Chưa có bộ truyện nào</h3>
                  <p className="text-xs text-slate-500 mt-1">Hãy bấm vào nút bên dưới để tạo bộ truyện đầu tiên của bạn!</p>
                </div>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Bắt Đầu Tạo Truyện Mới
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.map((p) => {
                  const isCurrent = p.id === currentProjectId;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative group ${
                        isCurrent
                          ? 'bg-indigo-950/30 border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-950/50'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        {/* Status Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-medium border border-slate-700">
                            {p.genre || 'Tiên Hiệp'}
                          </span>
                          {isCurrent ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Đang chỉnh sửa
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {p.model || 'gemini-3.6-flash'}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-base font-bold text-white line-clamp-1 mb-1 group-hover:text-indigo-300 transition-colors">
                          {p.title}
                        </h4>

                        {/* Meta info */}
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            {p.chapterCount || p.totalChapters || (p.chapters ? p.chapters.length : 0)} chương
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('vi-VN') : 'Mới tạo'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            onSelectProject(p.id);
                            onClose();
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          }`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>{isCurrent ? 'Đang Mở' : 'Mở Dịch'}</span>
                        </button>

                        <button
                          onClick={() => onDeleteProject(p.id, p.title)}
                          title="Xóa dự án truyện này"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <form onSubmit={handleCreate} className="max-w-xl mx-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tên Bộ Truyện <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đấu Phá Khung Thương, Toàn Chức Cao Thủ..."
                  required
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Thể Loại
                  </label>
                  <select
                    value={genre}
                    onChange={e => setGenre(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="Tiên Hiệp / Tu Chân">Tiên Hiệp / Tu Chân</option>
                    <option value="Huyền Huyễn / Dị Giới">Huyền Huyễn / Dị Giới</option>
                    <option value="Đô Thị / Trọng Sinh">Đô Thị / Trọng Sinh</option>
                    <option value="Ngôn Tình / Hiện Đại">Ngôn Tình / Hiện Đại</option>
                    <option value="Bách Hợp / Đam Mỹ">Bách Hợp / Đam Mỹ</option>
                    <option value="Cổ Đại / Cung Đấu">Cổ Đại / Cung Đấu</option>
                    <option value="Võ Hiệp / Kiếm Hiệp">Võ Hiệp / Kiếm Hiệp</option>
                    <option value="Mạt Thế / Sinh Tồn">Mạt Thế / Sinh Tồn</option>
                    <option value="Khoa Huyễn / Cơ Giáp">Khoa Huyễn / Cơ Giáp</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Model AI Mặc Định
                  </label>
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash (Nhanh & Chuẩn nhất)</option>
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Tiết kiệm Quota)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Rất nhanh)</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Văn học cao cấp)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Đặc Tả Văn Phong & Yêu Cầu Xưng Hô Ban Đầu (Tùy chọn)
                </label>
                <textarea
                  value={toneGuidance}
                  onChange={e => setToneGuidance(e.target.value)}
                  placeholder="Ví dụ: Văn phong tu tiên cổ phong hào sảng, xưng hô tôn ti sư đồ rõ ràng. Nhân vật chính xưng ta - gọi kẻ thù là ngươi..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={creating || !title.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Tạo Dự Án & Bắt Đầu Dịch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
