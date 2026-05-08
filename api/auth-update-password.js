export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { access_token, password } = req.body;
  if (!access_token || !password) return res.status(400).json({ error: 'データが不足しています' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    // まずtoken_hashで認証を試みる
    let authToken = access_token;

    // token_hashの場合はverifyOtpで交換
    if (!access_token.startsWith('eyJ')) {
      const verifyResp = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          token_hash: access_token,
          type: 'recovery'
        })
      });
      const verifyData = await verifyResp.json();
      if (!verifyResp.ok) {
        return res.status(400).json({ error: 'トークンが無効か期限切れです。もう一度リセットメールを送ってください。' });
      }
      authToken = verifyData.access_token;
    }

    // パスワード更新
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ password })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(400).json({ error: data.message || 'パスワード変更に失敗しました' });
    return res.status(200).json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
