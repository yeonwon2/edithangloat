import React, { useState } from 'react';
import { Settings, Save, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ProjectSettings({ project, onUpdateProject }) {
  const [formData, setFormData] = useState({
    title: project?.title || '',
    genre: project?.genre || 'Tiên Hiệp',
    model: project?.model || 'gemini-2.5-flash',
    toneGuidance: project?.toneGuidance || 'Văn phong hào sảng, cổ phong, xưng hô tôn ti rõ ràng, lời thoại giàu cảm xúc'
  });
  const [saved, setSaved] = useState(false);

  const genres = [
    'Tiên Hiệp / Tu Chân',
    'Huyền Huyễn / Dị Giới',
    'Đô Thị / Trọng Sinh',
    'Ngôn Tình / Hiện Đại',
    'Cổ Đại / Cung Đấu / Gia Đấu',
    'Võ Hiệp / Kiếm Hiệp Cổ Điển',
    'Mạt Thế / Zombie / Sinh Tồn',
    'Khoa Huyễn / Cơ Giáp / Vũ Trụ',
    'Võng Du / Game Thủ / E-Sports',
    'Kinh Dị / Huyền Bí / Trinh Thám',
    'Đồng Nhân / Anime'
  ];

  const models = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Khuyên dùng - Thế hệ mới nhất, siêu nhanh & thông minh)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Cực kỳ ổn định, tương thích 100% mọi API Key)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Đỉnh cao suy luận ngữ cảnh sâu & văn phong mượt)' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Tiết kiệm token tối đa)' }
  ];

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.project) onUpdateProject(data.project);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Lỗi lưu cấu hình: ' + e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Thiết Lập Bối Cảnh & Cấu Hình Dịch</h3>
              <p className="text-xs text-slate-400">Định hình văn phong và model AI phù hợp với từng thể loại truyện</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          {/* Novel Title */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Tên Truyện / Bộ Tiểu Thuyết:</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Genre */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Thể loại truyện:</label>
            <select
              value={formData.genre}
              onChange={e => setFormData({ ...formData, genre: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {genres.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Gemini Model - Direct Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200">Tên Model Gemini (Tự nhập tùy ý):</label>
              <span className="text-[11px] text-indigo-400 font-mono">Đang chọn: {formData.model}</span>
            </div>
            <input
              type="text"
              list="gemini-models-list"
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value.trim() })}
              placeholder="Nhập tên model, ví dụ: gemini-3.6-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <datalist id="gemini-models-list">
              <option value="gemini-3.6-flash" />
              <option value="gemini-3.5-flash-lite" />
              <option value="gemini-3.1-flash-lite" />
              <option value="gemini-3.5-flash" />
              <option value="gemini-2.5-flash" />
              <option value="gemini-2.5-flash-lite" />
              <option value="gemini-2.5-pro" />
            </datalist>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500">Gợi ý nhanh:</span>
              {['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormData({ ...formData, model: m })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border ${
                    formData.model === m
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Tone & Style Guidance */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Hướng dẫn Văn phong & Quy chuẩn Dịch:
            </label>
            <textarea
              rows={4}
              value={formData.toneGuidance}
              onChange={e => setFormData({ ...formData, toneGuidance: e.target.value })}
              placeholder="Ví dụ: Văn phong kiếm hiệp cổ kính, hào hùng, nhân vật chính xưng 'ta', gọi sư phụ là 'sư tôn', xưng hô tuyệt đối không dùng tôi-anh..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />
            <p className="text-[11px] text-slate-500">
              Gợi ý này sẽ được gửi kèm trong prompt hệ thống của mỗi chương để hướng dẫn Gemini định hình giọng văn chuẩn xác.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div>
            {saved && (
              <span className="text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình thành công!
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/30"
          >
            <Save className="w-4 h-4" /> Lưu Cấu Hình
          </button>
        </div>
      </div>
    </div>
  );
}
