export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'メールアドレスが必要です' });

  try {
    // 顧客を検索
    const custResp = await fetch('https://api.stripe.com/v1/customers/search?query=email:"' + encodeURIComponent(email) + '"', {
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
    });
    const custData = await custResp.json();

    if (!custData.data || custData.data.length === 0) {
      return res.status(200).json({ active: false, trial: false });
    }

    const customerId = custData.data[0].id;

    // サブスクリプション確認
    const subResp = await fetch('https://api.stripe.com/v1/subscriptions?customer=' + customerId + '&status=all', {
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
    });
    const subData = await subResp.json();

    if (!subData.data || subData.data.length === 0) {
      return res.status(200).json({ active: false, trial: false });
    }

    const sub = subData.data[0];
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    const isTrial = sub.status === 'trialing';
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toLocaleDateString('ja-JP') : null;

    return res.status(200).json({ active: isActive, trial: isTrial, trialEnd, status: sub.status });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
