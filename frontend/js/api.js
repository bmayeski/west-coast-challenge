import { closeScoreModal } from './uiModal.js';

export async function fetchDatabase() {
  // Replace these with your actual Supabase credentials
  const SUPABASE_URL = 'https://lzridmgajncsntnuyrrw.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cmlkbWdham5jc250bnV5cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjUzOTIsImV4cCI6MjEwMjkwMTM5Mn0.e5T5N1NauSB1rHT0IGqSuqB-CO2nuWpJn8On2o8Nvko';

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch Pools
    const poolsRes = await fetch(`${SUPABASE_URL}/rest/v1/pools?select=*`, { headers });
    const pools = await poolsRes.json();

    // 2. Fetch Teams
    const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=*`, { headers });
    const teams = await teamsRes.json();

    // 3. Fetch Matches
    const matchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*`, { headers });
    const matches = await matchesRes.json();

    // ADD THIS LINE TO SEE WHAT SUPABASE IS SENDING:
    console.log("Supabase Data:", { pools, teams, matches });

    return { pools, teams, matches };
  } catch (error) {
    console.error("Failed to fetch from Supabase:", error);
    return { pools: [], teams: [], matches: [] };
  }
}

export async function submitScoreUpdate(refreshCallback) {
  const saveBtn = document.getElementById('saveScoreBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';
  }

  const payload = {
    matchId: document.getElementById('modalMatchId').value,
    s1a: document.getElementById('modalS1A').value,
    s1b: document.getElementById('modalS1B').value,
    s2a: document.getElementById('modalS2A').value,
    s2b: document.getElementById('modalS2B').value,
    s3a: document.getElementById('modalS3A').value,
    s3b: document.getElementById('modalS3B').value,
    status: document.getElementById('modalStatus').value
  };

  try {
    const res = await fetch('/api/updateScore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Failed to update score');

    closeScoreModal();
    if (typeof refreshCallback === 'function') {
      await refreshCallback();
    }
  } catch (err) {
    alert(`Error saving score: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Save Score';
    }
  }
}