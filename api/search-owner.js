export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { image, mediaType, facility } = req.body;
  if (!image || !mediaType) return res.status(400).json({ error: '画像データが不足しています' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // 1. AIで落とし物を分析
    const analyzeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: `この画像に写っている落とし物を分析してください。
必ずJSON形式のみで返答してください。
形式: {"category": "カテゴリー名", "name": "品目名", "color": "色", "keywords": ["検索キーワード1", "検索キーワード2", "検索キーワード3"]}
カテゴリーは「衣類」「日用品」「貴重品」「電化製品」「趣味・娯楽」「医療用品」「その他」のいずれか。
keywordsは色・素材・特徴など照合に使える単語を3〜5個。` }
          ]
        }]
      })
    });

    const analyzeData = await analyzeResp.json();
    const text = analyzeData.content[0].text.replace(/```json|```/g, '').trim();
    const lostItem = JSON.parse(text);

    // 2. 全入居者データを取得
    let url = `${SUPABASE_URL}/rest/v1/residents?order=resident_name.asc`;
    if (facility) url += `&facility_name=eq.${encodeURIComponent(facility)}`;

    const residentsResp = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const residents = await residentsResp.json();

    // 3. 持ち物データと照合してスコアリング
    const results = [];
    residents.forEach(function(r) {
      const items = JSON.parse(r.items || '[]');
      var matchScore = 0;
      var matchedItems = [];

      items.forEach(function(item) {
        var score = 0;
        // カテゴリー一致
        if (item.category === lostItem.category) score += 3;
        // 品目名の部分一致
        if (item.name && lostItem.name && item.name.includes(lostItem.name)) score += 5;
        if (item.name && lostItem.name && lostItem.name.includes(item.name)) score += 3;
        // 色の一致
        if (item.color && lostItem.color && item.color !== 'なし' &&
            (item.color.includes(lostItem.color) || lostItem.color.includes(item.color))) score += 4;
        // キーワード照合
        if (lostItem.keywords) {
          lostItem.keywords.forEach(function(kw) {
            if (item.name && item.name.includes(kw)) score += 2;
            if (item.color && item.color.includes(kw)) score += 2;
            if (item.note && item.note.includes(kw)) score += 1;
          });
        }
        if (score > 0) {
          matchScore += score;
          matchedItems.push({ name: item.name, color: item.color, score: score });
        }
      });

      if (matchScore > 0) {
        results.push({
          id: r.id,
          resident_name: r.resident_name,
          room_number: r.room_number,
          facility_name: r.facility_name,
          matchScore: matchScore,
          matchedItems: matchedItems.sort(function(a, b) { return b.score - a.score; }).slice(0, 3)
        });
      }
    });

    // スコア順に並び替え
    results.sort(function(a, b) { return b.matchScore - a.matchScore; });

    return res.status(200).json({
      lostItem: lostItem,
      results: results.slice(0, 5) // 上位5件
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
