export default async function handler(req, res) {
  // 管理者パスワード確認
  const { password } = req.method === 'POST' ? req.body : req.query;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: '管理者パスワードが違います' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // Supabaseからユーザー一覧取得
    const usersResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    const usersData = await usersResp.json();
    const users = usersData.users || [];

    // 入居者数を施設ごとに集計
    const residentsResp = await fetch(`${SUPABASE_URL}/rest/v1/residents?select=facility_name`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    const residents = await residentsResp.json();

    // 施設ごとの入居者数をカウント
    const residentCount = {};
    residents.forEach(r => {
      residentCount[r.facility_name] = (residentCount[r.facility_name] || 0) + 1;
    });

    // Stripeからサブスクリプション情報取得
    const stripeResp = await fetch('https://api.stripe.com/v1/subscriptions?limit=100&status=all', {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const stripeData = await stripeResp.json();
    const subscriptions = stripeData.data || [];

    // 顧客情報取得
    const customersResp = await fetch('https://api.stripe.com/v1/customers?limit=100', {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const customersData = await customersResp.json();
    const customers = customersData.data || [];

    // メールとサブスクリプションを紐付け
    const emailToSub = {};
    customers.forEach(c => {
      const sub = subscriptions.find(s => s.customer === c.id);
      if (sub) emailToSub[c.email] = sub;
    });

    // ユーザー情報を整形
    const facilities = users.map(u => {
      const sub = emailToSub[u.email];
      const facilityName = u.user_metadata?.facility_name || '未設定';
      return {
        id: u.id,
        email: u.email,
        facility_name: facilityName,
        created_at: new Date(u.created_at).toLocaleDateString('ja-JP'),
        last_sign_in: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ja-JP') : 'なし',
        resident_count: residentCount[facilityName] || 0,
        subscription_status: sub ? sub.status : 'none',
        trial_end: sub?.trial_end ? new Date(sub.trial_end * 1000).toLocaleDateString('ja-JP') : null
      };
    });

    // 登録日順に並び替え
    facilities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      total: facilities.length,
      trialing: facilities.filter(f => f.subscription_status === 'trialing').length,
      active: facilities.filter(f => f.subscription_status === 'active').length,
      facilities
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
