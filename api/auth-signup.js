export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password, facility_name } = req.body;
  if (!email || !password || !facility_name) return res.status(400).json({ error: '全項目を入力してください' });

  try {
    // ユーザー登録
    const signupResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: { facility_name } })
    });
    const signupData = await signupResp.json();
    if (!signupResp.ok) return res.status(400).json({ error: signupData.message || '登録に失敗しました' });
    return res.status(200).json({ success: true, user: signupData.user });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
