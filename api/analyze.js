export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const { image, mediaType } = req.body;
 
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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: `この画像に写っている全ての持ち物を詳細に識別してください。
複数のアイテムが写っている場合は全て列挙してください。
 
各アイテムについて以下を判定してください：
- カテゴリー：「衣類」「日用品」「貴重品」「電化製品」「趣味・娯楽」「医療用品」のいずれか
- 品目名：具体的に（例：長袖シャツ、歯ブラシ、財布など）
- 色：衣類・日用品は具体的に、その他は「なし」
- カラーコード：色がある場合は16進数、ない場合は#888888
- 数量：見える個数
- 備考：ブランド・状態・特徴など
 
必ずJSON形式のみで返答してください。他の文字は一切含めないでください。
形式: {"items": [{"category": "カテゴリー名", "name": "品目名", "color": "色", "colorCode": "#xxxxxx", "count": 数量, "note": "備考"}]}
持ち物が見えない場合はitemsを空配列にしてください。` }
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
