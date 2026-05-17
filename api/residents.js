export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
  };

  // 履歴追加（POST）
  if (req.method === 'POST') {
    const { resident_id, action, item_name, detail } = req.body;
    if (!resident_id || !action) return res.status(400).json({ error: 'データが不足しています' });
    try {
      const resp = await fetch(SUPABASE_URL + '/rest/v1/item_history', {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ resident_id, action, item_name: item_name || '', detail: detail || '' })
      });
      if (!resp.ok) {
        const err = await resp.json();
        return res.status(500).json({ error: JSON.stringify(err) });
      }
      return res.status(200).json({ success: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { facility, admin, password, history, resident_id } = req.query;

  // 履歴取得
  if (history === 'true') {
    if (!resident_id) return res.status(400).json({ error: 'resident_idが必要です' });
    try {
      const resp = await fetch(
        SUPABASE_URL + '/rest/v1/item_history?resident_id=eq.' + resident_id + '&order=created_at.desc&limit=50',
        { headers }
      );
      const data = await resp.json();
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 管理者モード
  if (admin === 'true') {
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: '管理者パスワードが違います' });
    }
    try {
      const usersResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users?per_page=1000', {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY }
      });
      const usersData = await usersResp.json();
      const users = usersData.users || [];

      const residentsResp = await fetch(SUPABASE_URL + '/rest/v1/residents?select=facility_name', { headers });
      const residents = await residentsResp.json();
      const residentCount = {};
      residents.forEach(function(r) {
        residentCount[r.facility_name] = (residentCount[r.facility_name] || 0) + 1;
      });

      const stripeResp = await fetch('https://api.stripe.com/v1/subscriptions?limit=100&status=all', {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const stripeData = await stripeResp.json();
      const subscriptions = stripeData.data || [];

      const customersResp = await fetch('https://api.stripe.com/v1/customers?limit=100', {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const customersData = await customersResp.json();
      const customers = customersData.data || [];

      const emailToSub = {};
      customers.forEach(function(c) {
        const sub = subscriptions.find(function(s) { return s.customer === c.id; });
        if (sub) emailToSub[c.email] = sub;
      });

      const facilities = users.map(function(u) {
        const sub = emailToSub[u.email];
        const facilityName = (u.user_metadata && u.user_metadata.facility_name) || '未設定';
        return {
          id: u.id,
          email: u.email,
          facility_name: facilityName,
          created_at: new Date(u.created_at).toLocaleDateString('ja-JP'),
          last_sign_in: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ja-JP') : 'なし',
          resident_count: residentCount[facilityName] || 0,
          subscription_status: sub ? sub.status : 'none',
          trial_end: sub && sub.trial_end ? new Date(sub.trial_end * 1000).toLocaleDateString('ja-JP') : null
        };
      });

      facilities.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

      return res.status(200).json({
        total: facilities.length,
        trialing: facilities.filter(function(f) { return f.subscription_status === 'trialing'; }).length,
        active: facilities.filter(function(f) { return f.subscription_status === 'active'; }).length,
        facilities
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 通常モード（入居者一覧取得）
  try {
    let url = SUPABASE_URL + '/rest/v1/residents?order=created_at.desc';
    if (facility) url += '&facility_name=eq.' + encodeURIComponent(facility);
    const response = await fetch(url, { headers });
    const data = await response.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
