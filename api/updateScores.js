import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { matchId, s1a, s1b, s2a, s2b, s3a, s3b, status } = req.body;

    if (!matchId) {
      return res.status(400).json({ error: 'Missing matchId' });
    }

    const { data, error } = await supabase
      .from('matches')
      .update({
        s1a: s1a ?? '',
        s1b: s1b ?? '',
        s2a: s2a ?? '',
        s2b: s2b ?? '',
        s3a: s3a ?? '',
        s3b: s3b ?? '',
        status: status || 'Complete'
      })
      .eq('id', matchId)
      .select();

    if (error) throw error;

    res.status(200).json({ success: true, updatedMatch: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}