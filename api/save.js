export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { facility_name, resident_name, room_number, items, registered_date, resident_id } = req.body;

  if (!resident_name || !items) {
    return res.status(400).json({ error: 'データが不足しています' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  try {
    if (resident_id) {
      // 既存の入居者に追記
      const getResp = await fetch(`${SUPABASE_URL}/rest/v1/residents?id=eq.${resident_id}`, { headers });
      const existing = await getResp.json();
      if (existing.length > 0) {
        const oldItems = JSON.parse(existing[0].items || '[]');
        const newCats = [...new Set(items.map(i => i.category))];
        const mergedItems = [
          ...oldItems.filter(i => !newCats.includes(i.category)),
          ...items
        ];
        const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/residents?id=eq.${resident_id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            items: JSON.stringify(mergedItems),
            registered_date
          })
        });
        if (!updateResp.ok) {
          const err = await updateResp.json();
          return res.status(500).json({ error: JSON.stringify(err) });
        }
        const data = await updateResp.json();
        return res.status(200).json({ success: true, data, merged: true });
      }
    }

    // 同じ施設・入居者名・部屋番号で検索
    let searchUrl = `${SUPABASE_URL}/rest/v1/residents?resident_name=eq.${encodeURIComponent(resident_name)}`;
    if (facility_name) searchUrl += `&facility_name=eq.${encodeURIComponent(facility_name)}`;
    if (room_number) searchUrl += `&room_number=eq.${encodeURIComponent(room_number)}`;

    const searchResp = await fetch(searchUrl, { headers });
    const existing = await searchResp.json();

    if (existing.length > 0) {
      // 既存に追記
      const oldItems = JSON.parse(existing[0].items || '[]');
      const newCats = [...new Set(items.map(i => i.category))];
      const mergedItems = [
        ...oldItems.filter(i => !newCats.includes(i.category)),
        ...items
      ];
      const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/residents?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ items: JSON.stringify(mergedItems), registered_date })
      });
      const data = await updateResp.json();
      return res.status(200).json({ success: true, data, merged: true });
    }

    // 新規登録
    const createResp = await fetch(`${SUPABASE_URL}/rest/v1/residents`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        facility_name: facility_name || '',
        resident_name,
        room_number: room_number || '',
        items: JSON.stringify(items),
        registered_date
      })
    });
    if (!createResp.ok) {
      const err = await createResp.json();
      return res.status(500).json({ error: JSON.stringify(err) });
    }
    const data = await createResp.json();
    return res.status(200).json({ success: true, data, merged: false });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
