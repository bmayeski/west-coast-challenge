import { closeScoreModal } from './uiModal.js';

// 1. Move credentials to the top so ALL functions can access them!
const SUPABASE_URL = 'https://lzridmgajncsntnuyrrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cmlkbWdham5jc250bnV5cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjUzOTIsImV4cCI6MjEwMjkwMTM5Mn0.e5T5N1NauSB1rHT0IGqSuqB-CO2nuWpJn8On2o8Nvko';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

export async function fetchDatabase() {
  try {
    const poolsRes = await fetch(`${SUPABASE_URL}/rest/v1/pools?select=*`, { headers });
    const pools = await poolsRes.json();

    const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=*`, { headers });
    const teams = await teamsRes.json();

    const matchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*`, { headers });
    const matches = await matchesRes.json();

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

// 2. Updated to use standard fetch to match your architecture
export async function verifyAdminPassword(passwordAttempt) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?select=password&limit=1`, { headers });
        const data = await res.json();
        
        if (!data || data.length === 0) return false;
        
        // Supabase returns an array for selects, so we check the first row
        return data[0].password === passwordAttempt;
    } catch (err) {
        console.error("Auth check failed:", err);
        return false;
    }
}

// --- NEW ADMIN FUNCTIONS ---

export async function adminInsertPool(poolName, siteName) {
    try {
        const payload = { name: poolName, site: siteName };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pools`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=minimal' // Tells Supabase we don't need the whole row sent back
            },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (err) {
        console.error("Error creating pool:", err);
        return false;
    }
}

export async function adminUploadLogo(file) {
    if (!file) return null;
    
    // Create a unique file name so we don't accidentally overwrite logos with the same name
    const fileExt = file.name.split('.').pop();
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${uniqueFileName}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': file.type
            },
            body: file
        });
        
        if (!res.ok) throw new Error('Upload failed');
        
        // Return the permanent, public URL for the new image!
        return `${SUPABASE_URL}/storage/v1/object/public/logos/${uniqueFileName}`;
    } catch (err) {
        console.error("Logo upload error:", err);
        return null;
    }
}

export async function adminInsertTeam(teamName, color, logoUrl) {
    try {
        const payload = { 
            name: teamName, 
            color: color, 
            logoId: logoUrl // Saving the full Supabase URL here now!
        };
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (err) {
        console.error("Error creating team:", err);
        return false;
    }
}