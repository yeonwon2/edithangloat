import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';

export default function KeyManagerModal({ isOpen, onClose, onKeysUpdated }) {
  const [keys, setKeys] = useState([]);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testModel, setTestModel] = useState('gemini-2.0-flash');

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
    }
  }, [isOpen]);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/keys');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeys = async () => {
    if (!newKeyInput.trim()) return;
    const lines = newKeyInput.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    try {
      setLoading(true);
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: lines })
      });
      const data = await res.json();
      setKeys(data.keys || []);
      setNewKeyInput('');
      if (onKeysUpdated) onKeysUpdated(data.keys);
    } catch (e) {
      alert('Lỗi lưu keys: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/keys/reset', { method: 'POST' });
      const data = await res.json();
      setKeys(data.keys || []);
      if (onKeysUpdated) onKeysUpdated(data.keys);
      alert('Đã khôi phục trạng thái hoạt động cho toàn bộ API Keys!');
    } catch (e) {
      alert('Lỗi khôi phục: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (keyToDelete) => {
    if (!confirm('Bạn có chắc muốn xóa key này?')) return;
    try {
      setLoading(true);
      const remainingKeys = keys.filter(k => k.id !== keyToDelete.id).map(k => k.key || k.maskedKey);
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: remainingKeys })
      });
      const data = await res.json();
      setKeys(data.keys || []);
      if (onKeysUpdated) onKeysUpdated(data.keys);
    } catch (e) {
      alert('Lỗi xóa key: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestKey = async (keyItem) => {
    setTestingId(keyItem.id);
    setTestResult(null);
    try {
      const res = await fetch('/api/keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyItem.key || undefined,
          model: testModel
        })
      });
      const data = await res.json();
      setTestResult({
        id: keyItem.id,
        success: data.success,
        message: data.message
      });
      fetchKeys();
    } catch (e) {
      setTestResult({
        id: keyItem.id,
        success: false,
        message: e.message
      });
    } finally {
      setTestingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Quản lý Gemini API Key</h3>
              <p className="text-xs text-slate-400">Hỗ trợ nhiều key để tự động xoay tua (Round-Robin) và chống chạm Rate Limit</p>
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-sm">
          {/* Add Key Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Nhập API Key mới (Có thể dán nhiều key, mỗi key 1 dòng):
            </label>
            <textarea
              rows={3}
              value={newKeyInput}
              onChange={e => setNewKeyInput(e.target.value)}
              placeholder="AIzaSyA...\nAIzaSyB..."
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-200 text-sm font-mono focus:outline-none focus:border-indigo-500 transition placeholder:text-slate-600"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500">
                Lấy API Key miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>
              </span>
              <button
                onClick={handleAddKeys}
                disabled={!newKeyInput.trim() || loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" /> Lưu Key
              </button>
            </div>
          </div>

          {/* Test Model Selector */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium">Model dùng để kiểm tra Key:</span>
            <div className="flex items-center gap-1.5 flex-1 max-w-xs">
              <input
                type="text"
                list="modal-test-models"
                value={testModel}
                onChange={e => setTestModel(e.target.value.trim())}
                placeholder="gemini-2.0-flash..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
              />
              <datalist id="modal-test-models">
                <option value="gemini-2.0-flash" />
                <option value="gemini-1.5-flash" />
                <option value="gemini-1.5-pro" />
                <option value="gemini-2.5-flash" />
                <option value="gemini-2.0-flash-lite" />
              </datalist>
            </div>
          </div>

          {/* Auto-Rotation Feature Banner */}
          <div className="p-3.5 bg-gradient-to-r from-indigo-950/50 to-purple-950/50 border border-indigo-800/40 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0 mt-0.5">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-indigo-300">Tự Động Xoay API Key Thông Minh (Auto-Rotate on Quota Exceeded)</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Bạn có thể nạp nhiều API Key (Key 1, Key 2, Key 3...). Khi một key hết hạn mức Quota hoặc bị Rate-Limit, hệ thống sẽ <strong>TỰ ĐỘNG XOAY NGAY LẬP TỨC</strong> sang key tiếp theo để quá trình dịch không bao giờ bị gián đoạn!
              </p>
            </div>
          </div>

          {/* Current Key List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Danh sách Keys hiện tại ({keys.length}):
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetKeys}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition"
                  title="Khôi phục tất cả key về trạng thái Hoạt động"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Khôi phục toàn bộ Key
                </button>
                <button
                  onClick={fetchKeys}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                </button>
              </div>
            </div>

            {keys.length === 0 ? (
              <div className="p-6 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center">
                <AlertCircle className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
                <p className="text-slate-300 font-medium">Chưa có API Key nào được cài đặt</p>
                <p className="text-xs text-slate-500 mt-1">Vui lòng dán ít nhất 1 key vào ô phía trên để bắt đầu dịch</p>
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map((k, idx) => (
                  <div
                    key={k.id || idx}
                    className="p-3 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        k.status === 'active' ? 'bg-emerald-400' :
                        k.status === 'rate_limited' ? 'bg-amber-400 animate-pulse' :
                        k.status === 'exhausted' ? 'bg-red-500' : 'bg-red-400'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200 text-xs font-semibold">{k.maskedKey}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            k.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            k.status === 'rate_limited' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            k.status === 'exhausted' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {k.status === 'active' ? '🟢 Sẵn sàng' :
                             k.status === 'rate_limited' ? '🟡 Chờ hồi phục (60s)' :
                             k.status === 'exhausted' ? '🔴 Hết Quota (Đã tự xoay)' : '⚠️ Lỗi'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Đã hoàn thành: {k.totalSuccess || 0} req | Lỗi: {k.errorCount || 0}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestKey(k)}
                        disabled={testingId === k.id}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        {testingId === k.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        Kiểm tra
                      </button>

                      <button
                        onClick={() => handleDeleteKey(k)}
                        className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition"
                        title="Xóa key này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/40 border-red-800 text-red-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
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
