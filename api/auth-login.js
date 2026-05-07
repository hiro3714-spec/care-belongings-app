export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });

  try {
    const loginResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password })
    });
    const loginData = await loginResp.json();
    if (!loginResp.ok) return res.status(400).json({ error: 'メールアドレスまたはパスワードが違います' });

    const facility_name = loginData.user?.user_metadata?.facility_name || '';
    return res.status(200).json({
      success: true,
      access_token: loginData.access_token,
      facility_name,
      email: loginData.user?.email
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
