export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, otp, password } = req.body;
  if (!email || !otp || !password) return res.status(400).json({ error: 'データが不足しています' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    // まずOTPでセッションを取得
    const verifyResp = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email,
        token: otp,
        type: 'recovery'
      })
    });

    const verifyData = await verifyResp.json();

    if (!verifyResp.ok || !verifyData.access_token) {
      // verifyが失敗した場合、エラー詳細をログ
      console.error('Verify failed:', JSON.stringify(verifyData));
      return res.status(400).json({ 
        error: 'コードが無効か期限切れです。もう一度リセットメールを送ってください。'
      });
    }

    // パスワード更新
    const updateResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${verifyData.access_token}`
      },
      body: JSON.stringify({ password })
    });

    const updateData = await updateResp.json();
    if (!updateResp.ok) {
      const msg = updateData.message || '';
      if (msg.includes('same password') || msg.includes('different password')) {
        return res.status(400).json({ error: '以前と同じパスワードは使用できません。新しいパスワードを設定してください。' });
      }
      return res.status(400).json({ error: 'パスワード変更に失敗しました。もう一度お試しください。' });
    }
    return res.status(200).json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
