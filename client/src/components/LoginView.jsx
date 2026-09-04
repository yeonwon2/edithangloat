import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Sparkles, Shield, KeyRound, ArrowRight, BookOpen, CheckCircle, Sun, Moon } from 'lucide-react';

export default function LoginView({ onLoginSuccess, theme = 'light', onToggleTheme }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu truy cập.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Mật khẩu không chính xác!');
      }

      // Save token
      if (rememberMe) {
        localStorage.setItem('dichtruyen_auth_token', data.token);
      } else {
        sessionStorage.setItem('dichtruyen_auth_token', data.token);
      }

      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Đã có lỗi xảy ra.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden app-bg text-slate-100 font-sans selection:bg-indigo-500 selection:text-white px-4">
      {/* Top Corner Theme Switcher */}
      {onToggleTheme && (
        <div className="absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`px-3 py-2 rounded-2xl border transition shadow-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              theme === 'light'
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title={theme === 'light' ? 'Chuyển sang giao diện Tối' : 'Chuyển sang giao diện Sáng'}
          >
            {theme === 'light' ? (
              <>
                <Sun className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-bold">Theme Sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="font-bold">Theme Tối</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] rounded-full bg-gradient-to-br from-indigo-600/25 to-purple-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-emerald-500/15 via-cyan-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
          backgroundSize: '28px 28px'
        }}
      />

      {/* Main Glass Card */}
      <div
        className={`w-full max-w-[440px] relative z-10 transition-all duration-300 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        <div className="login-card bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl">
          
          {/* Top Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-[0_10px_25px_rgba(99,102,241,0.4)] mb-4 ring-4 ring-indigo-500/20">
              <BookOpen className="w-8 h-8 text-white stroke-[2.2]" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 flex items-center justify-center gap-2">
              DichTruyenPro <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              Xưởng Dịch Thuật & Biên Tập Độc Quyền
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" /> Mật khẩu truy cập
                </label>
                <span className="text-[11px] text-indigo-300/80 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Bảo vệ Admin
                </span>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                {error}
              </div>
            )}

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/30 accent-indigo-600"
                />
                <span>Ghi nhớ đăng nhập trên máy này</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] text-white font-semibold text-sm shadow-[0_10px_25px_rgba(99,102,241,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang mở khóa...</span>
                </>
              ) : (
                <>
                  <span>Mở Khóa Không Gian Dịch</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Hint Card for first-time login */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-400">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-300 font-semibold">Mật khẩu mặc định ban đầu:</span>{' '}
                <code className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono font-bold">
                  lilyhub888
                </code>
                <p className="mt-1 text-slate-500">
                  Sau khi đăng nhập, bạn có thể bấm vào biểu tượng chìa khóa ở góc trên để đổi mật khẩu riêng bất kỳ lúc nào.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          DichTruyenPro Enterprise &bull; Cloudflare D1 High Availability
        </div>
      </div>
    </div>
  );
}
