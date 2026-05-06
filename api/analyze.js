export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const { image, mediaType, category, prompt, colored } = req.body;
 
  if (!image || !mediaType) {
    return res.status(400).json({ error: '画像データが不足しています' });
  }
 
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: `この画像に写っている${prompt}\n必ずJSON形式のみで返答。他の文字は含めないでください。\n形式: {"items": [{"name": "品目名", "color": "${colored ? '色（具体的に）' : 'なし'}", "colorCode": "${colored ? '#xxxxxx' : '#888888'}", "count": 数量, "note": "特記事項"}]}\n品目が見えない場合はitemsを空配列。` }
          ]
        }]
      })
    });
 
    if (!response.ok) {
      const errData = await response.json();
      return res.status(500).json({ error: errData.error?.message || 'API呼び出しに失敗しました' });
    }
 
    const data = await response.json();
    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || '解析に失敗しました' });
  }
}
