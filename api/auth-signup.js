export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password, facility_name } = req.body;
  if (!email || !password || !facility_name) return res.status(400).json({ error: '全項目を入力してください' });
 
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
 
  try {
    // 1. Supabaseでユーザー登録
    const signupResp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: { facility_name } })
    });
    const signupData = await signupResp.json();
    if (!signupResp.ok) return res.status(400).json({ error: signupData.message || '登録に失敗しました' });
 
    // 2. StripeでCustomerを作成
    const customerResp = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'email': email,
        'name': facility_name,
        'metadata[facility_name]': facility_name
      })
    });
    const customerData = await customerResp.json();
 
    if (!customerResp.ok) {
      console.error('Stripe customer creation failed:', customerData);
      // Stripeエラーがあっても登録は成功させる
      return res.status(200).json({ success: true, user: signupData.user });
    }
 
    // 3. 90日間のトライアルサブスクリプションを作成（カードなし）
    const subResp = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'customer': customerData.id,
        'items[0][price]': STRIPE_PRICE_ID,
        'trial_period_days': '90',
        'payment_settings[save_default_payment_method]': 'on_subscription',
        'trial_settings[end_behavior][missing_payment_method]': 'cancel'
      })
    });
    const subData = await subResp.json();
 
    if (!subResp.ok) {
      console.error('Stripe subscription creation failed:', subData);
    }
 
    return res.status(200).json({ success: true, user: signupData.user });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
