const Store = require('./src/services/store');
const proj = Store.getProjects()[0];
const ch1 = proj.chapters[0].originalText;
const key = Store.getConfig().apiKeys[0];

async function testSafety() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Dịch đoạn sau sang tiếng Việt:\n${ch1}` }] }]
    })
  });
  const data = await res.json();
  console.log('Default safety response:', JSON.stringify(data, null, 2));

  // Now test with BLOCK_NONE
  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
  ];

  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Dịch đoạn sau sang tiếng Việt:\n${ch1}` }] }],
      safetySettings
    })
  });
  const data2 = await res2.json();
  console.log('With BLOCK_NONE safety response:', JSON.stringify(data2, null, 2));
}

testSafety().catch(console.error);
