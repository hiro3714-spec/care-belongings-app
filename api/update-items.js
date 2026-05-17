export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  // 写真アップロード（POST）
  if (req.method === 'POST') {
    const { image, resident_id, file_type } = req.body;
    if (!image || !resident_id) return res.status(400).json({ error: 'データが不足しています' });
    try {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = file_type === 'image/png' ? 'png' : 'jpg';
      const fileName = resident_id + '.' + ext;

      const uploadResp = await fetch(
        SUPABASE_URL + '/storage/v1/object/resident-photos/' + fileName,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Content-Type': file_type || 'image/jpeg',
            'x-upsert': 'true'
          },
          body: buffer
        }
      );
      if (!uploadResp.ok) {
        const err = await uploadResp.json();
        return res.status(500).json({ error: JSON.stringify(err) });
      }
      const photoUrl = SUPABASE_URL + '/storage/v1/object/public/resident-photos/' + fileName;
      const updateResp = await fetch(
        SUPABASE_URL + '/rest/v1/residents?id=eq.' + resident_id,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ photo_url: photoUrl })
        }
      );
      if (!updateResp.ok) {
        const err = await updateResp.json();
        return res.status(500).json({ error: JSON.stringify(err) });
      }
      return res.status(200).json({ success: true, photo_url: photoUrl });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 荷物・退所チェック更新（PATCH）
  if (req.method === 'PATCH') {
    const { id, items, checkout_data } = req.body;
    if (!id || !items) return res.status(400).json({ error: 'データが不足しています' });
    try {
      const updateBody = { items: JSON.stringify(items), registered_date: new Date().toLocaleDateString('ja-JP') };
      if (checkout_data !== undefined) {
        updateBody.checkout_data = JSON.stringify(checkout_data);
      }
      const response = await fetch(SUPABASE_URL + '/rest/v1/residents?id=eq.' + id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateBody)
      });
      if (!response.ok) {
        const err = await response.json();
        return res.status(500).json({ error: JSON.stringify(err) });
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
