export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'メールアドレスを入力してください' });

  try {
    const resp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_ANON_KEY },
      body: JSON.stringify({ email })
    });
    // 存在しないメールでも成功を返す（セキュリティのため）
    return res.status(200).json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
