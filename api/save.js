export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { facility_name, resident_name, room_number, items, registered_date } = req.body;

  if (!resident_name || !items) {
    return res.status(400).json({ error: 'データが不足しています' });
  }

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/residents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        facility_name: facility_name || '',
        resident_name,
        room_number: room_number || '',
        items: JSON.stringify(items),
        registered_date
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: JSON.stringify(err) });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
