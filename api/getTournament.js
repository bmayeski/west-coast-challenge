import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    // 1. Fetch data concurrently
    const [poolsRes, teamsRes, matchesRes] = await Promise.all([
      supabase.from('pools').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*')
    ]);

    if (poolsRes.error || teamsRes.error || matchesRes.error) {
      throw new Error('Failed to query Supabase tables.');
    }

    // 2. Map JSON objects into 2D arrays expected by uiMath.js
    const pools = poolsRes.data.map(p => [p.id, p.site]);
    
    const teams = teamsRes.data.map(t => [
      t.id, t.name, null, t.logo_id, t.pool_id, t.seed, t.color
    ]);
    
    const matches = matchesRes.data.map(m => [
      m.id, m.match_type, m.team_a_id, m.team_b_id, m.ref_team_id, 
      m.pool_id, m.time, 
      m.s1a ?? '', m.s1b ?? '', 
      m.s2a ?? '', m.s2b ?? '', 
      m.s3a ?? '', m.s3b ?? '', 
      m.status ?? 'Pending'
    ]);

    // 3. Return payload
    res.status(200).json({ pools, teams, matches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}