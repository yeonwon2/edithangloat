const Translator = require('./src/services/translator');
const Store = require('./src/services/store');
const { geminiPool } = require('./src/services/geminiPool');

async function test() {
  const cfg = Store.getConfig();
  if (cfg.apiKeys) geminiPool.setKeys(cfg.apiKeys);

  console.log('Testing gemini-3.5-flash-lite...');
  try {
    const result = await Translator.translateChapter({
      rawTitle: '第一章 陨落的天才',
      rawText: '“斗之力，三段！”望着测验魔石碑上闪亮得甚至有些刺眼的五个大字，少年面无表情。',
      model: 'gemini-3.5-flash-lite'
    });
    console.log('Result:', result);
  } catch (err) {
    console.error('ERROR CATCH:', err);
  }
}

test();
