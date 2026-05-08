export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { access_token, password } = req.body;
  if (!access_token || !password) return res.status(400).json({ error: 'データが不足しています' });

  try {
    const resp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${access_token}`
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
