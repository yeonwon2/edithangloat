import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Layers,
  Users,
  Eye,
  Settings,
  Key,
  Download,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Zap,
  Lock,
  LogOut,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';

import LoginView from './components/LoginView';
import ChangePasswordModal from './components/ChangePasswordModal';
import ProjectManagerModal from './components/ProjectManagerModal';
import KeyManagerModal from './components/KeyManagerModal';
import ExportModal from './components/ExportModal';
import ImportModal from './components/ImportModal';
import BatchQueueView from './components/BatchQueueView';
import QuickTranslateTab from './components/QuickTranslateTab';
import GlossaryManager from './components/GlossaryManager';
import SideBySideEditor from './components/SideBySideEditor';
import ProjectSettings from './components/ProjectSettings';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'glossary' | 'editor' | 'settings'
  const [selectedChapterForEdit, setSelectedChapterForEdit] = useState(null);

  // Modals
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectGenre, setNewProjectGenre] = useState('Tiên Hiệp');

  // Key count
  const [keysCount, setKeysCount] = useState(0);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);

  // Theme State: 'light' | 'dark' (Default to light for eye-comfort)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dichtruyen_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dichtruyen_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('dichtruyen_auth_token') || sessionStorage.getItem('dichtruyen_auth_token');
    if (!token) {
      setIsAuthenticated(false);
      setAuthChecking(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/check', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        fetchProjects();
        fetchKeysCount();
      } else {
        localStorage.removeItem('dichtruyen_auth_token');
        sessionStorage.removeItem('dichtruyen_auth_token');
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn khóa và đăng xuất khỏi hệ thống không?')) {
      localStorage.removeItem('dichtruyen_auth_token');
      sessionStorage.removeItem('dichtruyen_auth_token');
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentProjectId) {
      fetchProjectDetail(currentProjectId);
    }
  }, [currentProjectId, isAuthenticated]);

  const fetchKeysCount = async () => {
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      const active = (data.keys || []).filter(k => k.status === 'active');
      setKeysCount(active.length);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.projects || []);
      setProjects(list);

      if (list.length > 0) {
        if (!currentProjectId || !list.some(p => p.id === currentProjectId)) {
          setCurrentProjectId(list[0].id);
        }
      } else {
        setCurrentProjectId(null);
        setCurrentProject(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjectDetail = async (id) => {
    if (!id) {
      setCurrentProject(null);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      const proj = data.project || (data.id ? data : null);
      setCurrentProject(proj);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateProject = async (projectData) => {
    const payload = typeof projectData === 'object' && projectData.title ? projectData : {
      title: newProjectTitle.trim(),
      genre: newProjectGenre
    };

    if (!payload.title) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const newProj = data.project || (data.id ? data : null);
      if (newProj) {
        setIsCreateModalOpen(false);
        setNewProjectTitle('');
        await fetchProjects();
        setCurrentProjectId(newProj.id);
        return newProj;
      }
    } catch (e) {
      alert('Lỗi tạo truyện: ' + e.message);
      throw e;
    }
  };

  const handleDeleteProject = async (id, title) => {
    const targetTitle = title || (projects.find(p => p.id === id)?.title) || 'này';
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn bộ truyện "${targetTitle}" cùng toàn bộ các chương và từ điển không?`)) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjects();
        if (currentProjectId === id) {
          setCurrentProjectId(null);
          setCurrentProject(null);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert('Lỗi xóa: ' + (errData.error || errData.message || 'Thất bại'));
      }
    } catch (e) {
      alert('Lỗi xóa: ' + e.message);
    }
  };

  const handleSelectChapterForEdit = (chapter) => {
    setSelectedChapterForEdit(chapter);
    setActiveTab('editor');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-wide text-slate-400">Đang kiểm tra bảo mật...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginView
        theme={theme}
        onToggleTheme={toggleTheme}
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          fetchProjects();
          fetchKeysCount();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen app-bg text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-indigo-600/30 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="brand-title font-extrabold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-300">
                  DichTruyenPro
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 font-semibold uppercase tracking-wider">
                  Gemini AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Dịch Hàng Loạt • Nhất Quán Xưng Hô 100% • Sạch Lỗi</p>
            </div>
          </div>

          {/* Project Selector & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Project Manager Button */}
            <button
              onClick={() => setIsProjectManagerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 transition flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
              title="Mở danh sách và quản lý tất cả các bộ truyện"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quản lý truyện</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                {projects.length}
              </span>
            </button>

            {/* Quick Project Select Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-sm">
              <span className="text-xs text-slate-400 font-medium hidden md:inline">Đang mở:</span>
              <select
                value={currentProjectId || ''}
                onChange={e => setCurrentProjectId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[190px] truncate"
              >
                {projects.length === 0 ? (
                  <option value="" className="bg-slate-900 text-slate-400">Chưa có truyện nào</option>
                ) : (
                  projects.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.title}
                    </option>
                  ))
                )}
              </select>

              <button
                onClick={() => setIsProjectManagerOpen(true)}
                title="Tạo truyện mới"
                className="p-1 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition"
              >
                <Plus className="w-4 h-4" />
              </button>

              {currentProjectId && (
                <button
                  onClick={() => handleDeleteProject(currentProjectId, currentProject?.title)}
                  title="Xóa bộ truyện đang chọn"
                  className="p-1 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* API Key Modal Button */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
                keysCount > 0
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-indigo-500/50'
                  : 'bg-red-950/40 border-red-800 text-red-300 animate-pulse'
              }`}
            >
              <Key className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">API Keys</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                keysCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500 text-white'
              }`}>
                {keysCount}
              </span>
            </button>

            {/* Export Button */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              disabled={!currentProject}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Xuất File</span>
            </button>

            {/* Theme Toggle Button (Sáng / Tối) */}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Chuyển sang giao diện Tối (Dark)' : 'Chuyển sang giao diện Sáng (Light)'}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer shadow-sm ${
                theme === 'light'
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="hidden md:inline font-bold">Theme Sáng</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="hidden md:inline font-bold">Theme Tối</span>
                </>
              )}
            </button>

            {/* Change Password Button */}
            <button
              onClick={() => setIsChangePassModalOpen(true)}
              title="Đổi mật khẩu truy cập"
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500/50 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline">Đổi pass</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Khóa và Đăng xuất"
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Khóa web</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`w-full mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col space-y-4 transition-all ${
        activeTab === 'editor' ? 'max-w-[99%] xl:px-8' : 'max-w-7xl'
      }`}>
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'quick'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" /> ⚡ Dán Văn Bản & Dịch Nhanh
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" /> Xưởng Dịch Hàng Loạt
            {currentProject?.chapters && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/50 text-slate-300 ml-1">
                {currentProject.chapters.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'glossary'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Ma Trận Xưng Hô & Từ Điển
            {currentProject?.characters && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950/50 text-slate-300 ml-1">
                {currentProject.characters.length + (currentProject.pronounMatrix?.length || 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Eye className="w-4 h-4" /> So Sánh & Biên Tập
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" /> Bối Cảnh & Model
          </button>
        </div>

        {/* Tab Contents */}
        {currentProject ? (
          <div className="flex-1">
            {activeTab === 'quick' && (
              <QuickTranslateTab
                project={currentProject}
                onUpdateProject={setCurrentProject}
                onSwitchToQueue={() => setActiveTab('queue')}
              />
            )}

            {activeTab === 'queue' && (
              <BatchQueueView
                project={currentProject}
                onUpdateProject={setCurrentProject}
                onSelectChapterForEdit={handleSelectChapterForEdit}
                onOpenImportModal={() => setIsImportModalOpen(true)}
              />
            )}

            {activeTab === 'glossary' && (
              <GlossaryManager
                project={currentProject}
                onUpdateProject={setCurrentProject}
              />
            )}

            {activeTab === 'editor' && (
              <SideBySideEditor
                project={currentProject}
                chapter={selectedChapterForEdit || (currentProject.chapters && currentProject.chapters[0])}
                onBack={() => setActiveTab('queue')}
                onUpdateChapter={(updated) => {
                  setSelectedChapterForEdit(updated);
                  const newChapters = currentProject.chapters.map(c => c.id === updated.id ? updated : c);
                  setCurrentProject({ ...currentProject, chapters: newChapters });
                }}
              />
            )}

            {activeTab === 'settings' && (
              <ProjectSettings
                project={currentProject}
                onUpdateProject={setCurrentProject}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            {activeTab === 'quick' ? (
              <QuickTranslateTab
                project={{ id: 'quick', title: 'Dịch Nhanh Trực Tiếp', genre: 'Tiên Hiệp', model: 'gemini-3.6-flash' }}
                onUpdateProject={() => {}}
                onSwitchToQueue={() => setIsProjectManagerOpen(true)}
              />
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 max-w-lg mx-auto my-8">
                <BookOpen className="w-14 h-14 mx-auto mb-3 opacity-30 text-indigo-400" />
                <h3 className="font-bold text-base text-slate-200">Chưa có dự án truyện nào được chọn</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  Tạo mới hoặc chọn một bộ truyện từ danh sách để bắt đầu dịch hàng loạt, quản lý nhân vật và chuẩn hóa xưng hô.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setIsProjectManagerOpen(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="w-4 h-4" /> Mở Quản Lý Truyện
                  </button>
                  <button
                    onClick={() => setActiveTab('quick')}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-amber-400" /> Dịch Nhanh
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        DichTruyenPro © 2026 • Hệ thống Dịch Truyện Chữ Hàng Loạt Chuyên Nghiệp bằng Google Gemini AI
      </footer>

      {/* Modals */}
      <KeyManagerModal
        isOpen={isKeyModalOpen}
        onClose={() => {
          setIsKeyModalOpen(false);
          fetchKeysCount();
        }}
        onKeysUpdated={() => fetchKeysCount()}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        project={currentProject}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        project={currentProject}
        onImportSuccess={() => fetchProjectDetail(currentProjectId)}
      />

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="font-semibold text-base text-white">Thêm Dự Án Truyện Mới</h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Tên Bộ Truyện:</label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={e => setNewProjectTitle(e.target.value)}
                  placeholder="Ví dụ: Phàm Nhân Tu Tiên, Già Thiên..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Thể Loại:</label>
                <select
                  value={newProjectGenre}
                  onChange={e => setNewProjectGenre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="Tiên Hiệp / Tu Chân">Tiên Hiệp / Tu Chân</option>
                  <option value="Huyền Huyễn / Dị Giới">Huyền Huyễn / Dị Giới</option>
                  <option value="Đô Thị / Trọng Sinh">Đô Thị / Trọng Sinh</option>
                  <option value="Ngôn Tình / Hiện Đại">Ngôn Tình / Hiện Đại</option>
                  <option value="Cổ Đại / Cung Đấu">Cổ Đại / Cung Đấu</option>
                  <option value="Võ Hiệp / Kiếm Hiệp">Võ Hiệp / Kiếm Hiệp</option>
                  <option value="Mạt Thế / Sinh Tồn">Mạt Thế / Sinh Tồn</option>
                  <option value="Khoa Huyễn / Cơ Giáp">Khoa Huyễn / Cơ Giáp</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectTitle.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
              >
                Tạo Dự Án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePassModalOpen}
        onClose={() => setIsChangePassModalOpen(false)}
      />

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(id) => setCurrentProjectId(id)}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
      />
    </div>
  );
}
