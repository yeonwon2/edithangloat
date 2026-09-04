// Verification Script for DichTruyenPro

const fs = require('fs');
const path = require('path');
const TextSplitter = require('./src/services/textSplitter');
const PostProcessor = require('./src/services/postProcessor');
const ExportService = require('./src/services/exportService');
const GlossaryEngine = require('./src/services/glossaryEngine');
const Store = require('./src/services/store');

async function runTests() {
  console.log('--- 1. Testing TextSplitter ---');
  const sampleRawNovel = `
第一章 少年出山
大荒无垠，群山巍峨。石村坐落在苍莽山脉中，四周高峰大壑，茫茫群山。
清晨，朝霞灿烂，仿若碎金一般洒落，沐浴在人身上暖洋洋。

第二章 柳神复苏
村头有一棵巨大的柳树，通体焦黑，只剩下一根柔弱的柳条。
石昊眨了眨大眼，看着柳树喃喃自语。

第三章 原始真解
骨文闪烁，神秘莫测。
石昊盘坐在村口的大青石上，开始修行。
`;

  const chapters = TextSplitter.splitIntoChapters(sampleRawNovel);
  console.log(`Split chapters detected: ${chapters.length}`);
  chapters.forEach(c => console.log(` - [Chương ${c.index}]: ${c.title} (${c.wordCount} từ)`));
  if (chapters.length !== 3) throw new Error(`Expected 3 chapters, got ${chapters.length}`);
  console.log('✓ TextSplitter PASSED!');

  console.log('\n--- 2. Testing PostProcessor (Linter & Quality Guard) ---');
  const testMachineText = 'Một cái thiếu niên tên là Tiêu Viêm. Của hắn đích sắc mặt có điểm khó coi, cái kia lão giả nói： “Hảo！” Nhưng 还有一些中文。';
  const postResult = PostProcessor.process(testMachineText, [
    { zh: '还有一些中文', vi: 'còn một ít chữ Trung' }
  ]);
  console.log('Cleaned text:', postResult.text);
  console.log('Issues detected:', postResult.issues);
  if (postResult.issues.length === 0) throw new Error('Expected postprocessor to flag issues');
  console.log('✓ PostProcessor PASSED!');

  console.log('\n--- 3. Testing GlossaryEngine ---');
  const glossary = new GlossaryEngine();
  glossary.setData({
    characters: [{ id: '1', zh: '石昊', vi: 'Thạch Hạo', gender: 'Nam', role: 'Nhân vật chính' }],
    pronounMatrix: [{ id: '1', speakerZh: '石昊', listenerZh: '柳神', speakerCallsSelf: 'ta / vãn bối', speakerCallsListener: 'Liễu Thần', notes: 'Kính trọng' }],
    terms: [{ id: '1', zh: '大荒', vi: 'Đại Hoang', category: 'Địa danh' }]
  });
  const contextStr = glossary.buildContextForTranslation('石昊走在大荒中');
  console.log('Generated Context:\n', contextStr);
  if (!contextStr.includes('Thạch Hạo') || !contextStr.includes('Đại Hoang')) throw new Error('Glossary context missing data');

  // Test Vietphrase format export/import
  const vpText = glossary.exportVietphrase();
  console.log('Exported Vietphrase sample:\n', vpText.slice(0, 100));
  const importedCount = glossary.importVietphrase('林动=Lâm Động#Nhân vật\n元力=Nguyên Lực#Tu luyện');
  console.log(`Imported from Vietphrase: ${importedCount} items`);
  console.log('✓ GlossaryEngine PASSED!');

  console.log('\n--- 4. Testing ExportService (TXT, ZIP, DOCX, EPUB) ---');
  const testChapters = [
    {
      title: 'Chương 1: Thiếu Niên Xuất Sơn',
      translatedTitle: 'Chương 1: Thiếu Niên Xuất Sơn',
      translatedText: 'Đại Hoang vô ngần, dãy núi nguy nga. Thạch Thôn tọa lạc bên trong dãy núi thương mang.'
    },
    {
      title: 'Chương 2: Liễu Thần Phục Tô',
      translatedTitle: 'Chương 2: Liễu Thần Phục Tô',
      translatedText: 'Đầu thôn có một cây liễu khổng lồ, toàn thân cháy đen, chỉ còn lại một cành liễu yếu ớt.'
    }
  ];

  // TXT
  const txtBuf = ExportService.exportMergedTxt('Thế Giới Hoàn Mỹ', testChapters);
  console.log(`TXT exported: ${txtBuf.length} bytes`);

  // ZIP
  const zipBuf = await ExportService.exportZip('Thế Giới Hoàn Mỹ', testChapters);
  console.log(`ZIP exported: ${zipBuf.length} bytes`);

  // DOCX
  const docxBuf = await ExportService.exportDocx('Thế Giới Hoàn Mỹ', testChapters);
  console.log(`DOCX exported: ${docxBuf.length} bytes`);

  // EPUB
  const epubBuf = await ExportService.exportEpub('Thế Giới Hoàn Mỹ', testChapters);
  console.log(`EPUB exported: ${epubBuf.length} bytes`);

  if (!txtBuf.length || !zipBuf.length || !docxBuf.length || !epubBuf.length) {
    throw new Error('Export buffer empty');
  }
  console.log('✓ ExportService PASSED!');

  console.log('\n🎉 ALL CORE TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
