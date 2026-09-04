// Gemini API Key Pool & Request Handler with Load Balancing and Exponential Backoff

class GeminiPool {
  constructor() {
    this.keys = []; // Array of { id, key, label, status: 'active' | 'rate_limited' | 'error', errorCount: 0, lastUsed: 0 }
    this.currentIndex = 0;
  }

  setKeys(keyStrings) {
    // keyStrings can be comma/newline separated or array
    let list = [];
    if (typeof keyStrings === 'string') {
      list = keyStrings.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    } else if (Array.isArray(keyStrings)) {
      list = keyStrings.map(k => (typeof k === 'string' ? k.trim() : k.key?.trim())).filter(Boolean);
    }

    this.keys = list.map((key, i) => {
      const existing = this.keys.find(k => k.key === key);
      return existing || {
        id: `key_${i + 1}`,
        key,
        label: `Key ${i + 1} (...${key.slice(-4)})`,
        status: 'active',
        errorCount: 0,
        lastUsed: 0,
        totalSuccess: 0
      };
    });
  }

  getKeys() {
    return this.keys.map(k => ({
      id: k.id,
      label: k.label,
      maskedKey: k.key.length > 8 ? `${k.key.slice(0, 4)}...${k.key.slice(-4)}` : '****',
      status: k.status,
      errorCount: k.errorCount,
      totalSuccess: k.totalSuccess
    }));
  }

  getNextKey(excludeKey = null) {
    if (!this.keys.length) {
      throw new Error('Chưa cấu hình Gemini API Key nào. Vui lòng nhập ít nhất 1 API key!');
    }

    // 1. First priority: active keys (not excluded)
    let candidates = this.keys.filter(k => k.status === 'active');
    if (excludeKey) {
      const filtered = candidates.filter(k => k.key !== excludeKey);
      if (filtered.length > 0) candidates = filtered;
    }

    // 2. Second priority: keys not permanently exhausted (e.g. rate_limited keys waiting)
    if (candidates.length === 0) {
      candidates = this.keys.filter(k => k.status !== 'exhausted');
      if (excludeKey && candidates.length > 1) {
        const filtered = candidates.filter(k => k.key !== excludeKey);
        if (filtered.length > 0) candidates = filtered;
      }
    }

    // 3. Fallback: all keys
    if (candidates.length === 0) {
      candidates = this.keys;
    }

    // Round-robin selection among candidates
    this.currentIndex = (this.currentIndex + 1) % candidates.length;
    const selected = candidates[this.currentIndex];
    selected.lastUsed = Date.now();
    return selected;
  }

  markKeyStatus(apiKey, status, errorMsg = '') {
    const item = this.keys.find(k => k.key === apiKey);
    if (!item) return;
    item.status = status;
    if (status === 'error' || status === 'rate_limited' || status === 'exhausted') {
      item.errorCount = (item.errorCount || 0) + 1;
      item.lastError = errorMsg;
      // Auto recover rate-limited key after 60s (exhausted keys must be manually reset or daily refreshed)
      if (status === 'rate_limited') {
        setTimeout(() => {
          if (item.status === 'rate_limited') {
            item.status = 'active';
            console.log(`[API POOL] Key ${item.label} đã tự động hồi phục sau 60s chờ.`);
          }
        }, 60000);
      }
    } else if (status === 'active') {
      item.totalSuccess = (item.totalSuccess || 0) + 1;
      item.errorCount = 0;
    }
  }

  resetAllKeysStatus() {
    for (const item of this.keys) {
      item.status = 'active';
      item.errorCount = 0;
      item.lastError = '';
    }
    console.log('[API POOL] Đã reset trạng thái toàn bộ API Keys về Hoạt động.');
  }

  async fetchAvailableModels(apiKey) {
    const key = apiKey || (this.keys[0] ? this.keys[0].key : null);
    if (!key) return ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (data && data.models) {
        const textModels = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
          .filter(name => !name.includes('vision') && !name.includes('embedding') && !name.includes('aqa'));
        if (textModels.length > 0) return textModels;
      }
    } catch (e) {
      console.warn('Could not fetch models list:', e.message);
    }
    return ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];
  }

  normalizeModel(model) {
    if (!model) return 'gemini-3.6-flash';
    const m = model.trim().toLowerCase();
    if (m.includes('lite') || m.includes('3.1')) return 'gemini-3.1-flash-lite';
    return 'gemini-3.6-flash';
  }

  async testKey(apiKey, preferredModel = 'gemini-3.6-flash') {
    const normPreferred = this.normalizeModel(preferredModel);
    const candidateModels = [
      normPreferred,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite'
    ];
    const uniqueCandidates = Array.from(new Set(candidateModels.filter(Boolean)));

    let lastError = null;

    for (const testModel of uniqueCandidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Trả lời đúng 1 chữ: "OK"' }] }],
            generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
          })
        });

        const data = await response.json();
        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return {
            success: true,
            workingModel: testModel,
            message: `API Key hoạt động tốt! (Model: ${testModel})`
          };
        }

        const msg = data?.error?.message || `HTTP ${response.status}`;
        lastError = msg;

        // If not found or model not available for this key/version, try next model
        if (response.status === 404 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not supported')) {
          continue;
        }

        return { success: false, message: msg };
      } catch (err) {
        lastError = err.message;
      }
    }

    return { success: false, message: lastError || 'Không thể kết nối đến Gemini API' };
  }

  async callGeminiWithRetry({
    prompt,
    systemInstruction = '',
    model = 'gemini-3.6-flash',
    temperature = 0.3,
    maxRetries = 5,
    providedKey = null
  }) {
    let attempts = 0;
    let lastError = null;

    const normModel = this.normalizeModel(model || 'gemini-3.6-flash');
    const fallbackChain = [
      normModel,
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite'
    ].filter(Boolean);
    let modelIndex = 0;

    const totalKeyCount = this.keys.length || 1;
    const effectiveMaxRetries = Math.max(maxRetries, totalKeyCount * 3);

    let lastUsedKey = null;

    while (attempts < effectiveMaxRetries) {
      attempts++;
      const currentKeyObj = providedKey ? { key: providedKey } : this.getNextKey(lastUsedKey);
      const apiKey = currentKeyObj.key;
      lastUsedKey = apiKey;
      const currentModel = fallbackChain[modelIndex] || 'gemini-3.6-flash';

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          topP: 0.95
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      };

      if (systemInstruction) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          if (!providedKey) this.markKeyStatus(apiKey, 'active');
          return data.candidates[0].content.parts[0].text;
        }

        const finishReason = data?.candidates?.[0]?.finishReason;
        const errorMsg = data?.error?.message || (finishReason === 'SAFETY' ? 'Nội dung bị bộ lọc an toàn của Gemini chặn (SAFETY)' : `Lỗi HTTP ${response.status}`);

        // If model not found / not available, immediately switch to next fallback model
        if (response.status === 404 || errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('not supported')) {
          console.warn(`Model ${currentModel} không khả dụng. Đang chuyển sang model tiếp theo...`);
          if (modelIndex < fallbackChain.length - 1) {
            modelIndex++;
            continue;
          }
        }

        // Handle Quota Exhausted / Rate Limit: AUTO-ROTATE KEYS
        const isQuotaExhausted = response.status === 429 && (
          errorMsg.toLowerCase().includes('quota') ||
          errorMsg.toLowerCase().includes('resource_exhausted') ||
          errorMsg.toLowerCase().includes('exceeded') ||
          errorMsg.toLowerCase().includes('free_tier')
        );

        if (response.status === 429 || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('rate')) {
          const newStatus = isQuotaExhausted ? 'exhausted' : 'rate_limited';
          if (!providedKey) {
            this.markKeyStatus(apiKey, newStatus, errorMsg);
          }

          const otherKeysAvailable = this.keys.filter(k => k.key !== apiKey && k.status !== 'exhausted');

          if (otherKeysAvailable.length > 0) {
            console.warn(`[API AUTO-ROTATE] Key (...${apiKey.slice(-4)}) bị ${newStatus}. Đang TỰ ĐỘNG XOAY NGAY sang API key tiếp theo trong danh sách...`);
            // Zero delay: immediately retry with next key!
            continue;
          }

          // If no other keys, wait before retrying
          const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
          console.warn(`[API POOL] Tất cả key đang bận/hết quota. Đang chờ ${waitTime / 1000}s...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (response.status === 400 && (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('not valid'))) {
          if (!providedKey) this.markKeyStatus(apiKey, 'error', 'API Key không hợp lệ');
          console.warn(`[API AUTO-ROTATE] Key (...${apiKey.slice(-4)}) không hợp lệ. Đang chuyển sang key tiếp theo...`);
          continue;
        }

        if (response.status >= 500) {
          const waitTime = 1500 * attempts;
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        throw new Error(errorMsg);
      } catch (err) {
        lastError = err;
        if (!providedKey) this.markKeyStatus(apiKey, 'error', err.message);
        if (attempts >= effectiveMaxRetries) break;
        await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }

    throw new Error(`Đã thử ${effectiveMaxRetries} lần nhưng thất bại: ${lastError?.message || 'Không có phản hồi'}`);
  }
}

const geminiPool = new GeminiPool();
module.exports = { geminiPool, GeminiPool };

