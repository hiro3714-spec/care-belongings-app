export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, facility_name } = req.body;
  if (!email) return res.status(400).json({ error: 'メールアドレスが必要です' });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': process.env.STRIPE_PRICE_ID,
        'line_items[0][quantity]': '1',
        'customer_email': email,
        'success_url': 'https://care-belongings-app.vercel.app/?payment=success',
        'cancel_url': 'https://care-belongings-app.vercel.app/?payment=cancel',
        'subscription_data[trial_period_days]': '90',
        'metadata[facility_name]': facility_name || '',
        'locale': 'ja'
      })
    });

    const session = await response.json();
    if (!response.ok) return res.status(500).json({ error: session.error?.message || '決済セッションの作成に失敗しました' });
    return res.status(200).json({ url: session.url });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
