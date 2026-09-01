import { closeScoreModal } from './uiModal.js';

// 1. Credentials
const SUPABASE_URL = 'https://lzridmgajncsntnuyrrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cmlkbWdham5jc250bnV5cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjUzOTIsImV4cCI6MjEwMjkwMTM5Mn0.e5T5N1NauSB1rHT0IGqSuqB-CO2nuWpJn8On2o8Nvko';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

export let activeTournamentId = null;

// --- TOURNAMENT RESOLVER ---
export async function getActiveTournament() {
  if (activeTournamentId) return activeTournamentId; 

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('t');

  if (!slug) return null;

  try {
    // CHANGED: Now searching by slug=eq.${slug} instead of id=eq.${slug}
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?slug=eq.${slug}&select=id,name,status`, { headers });
    const data = await res.json();

    if (!data || data.length === 0) return null;

    activeTournamentId = data[0].id;
    return activeTournamentId;
  } catch (err) {
    console.error("Error fetching tournament by slug:", err);
    return null;
  }
}

// --- FETCH DATABASE DATA ---
export async function fetchDatabase() {
  try {
    const tournamentId = await getActiveTournament();

    if (!tournamentId) return { pools: [], teams: [], matches: [] };

    const poolsRes = await fetch(`${SUPABASE_URL}/rest/v1/pools?tournament_id=eq.${tournamentId}&select=*`, { headers });
    const pools = await poolsRes.json();

    const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?tournament_id=eq.${tournamentId}&select=*`, { headers });
    const teams = await teamsRes.json();

    const matchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?tournament_id=eq.${tournamentId}&select=*`, { headers });
    const matches = await matchesRes.json();

    return { pools, teams, matches };
  } catch (error) {
    console.error("Failed to fetch from Supabase:", error);
    return { pools: [], teams: [], matches: [] };
  }
}

// --- SCORE SUBMISSION ---
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

// --- STANDARD ADMIN AUTH (PER-TOURNAMENT) ---
export async function verifyAdminPassword(passwordAttempt) {
    if (!activeTournamentId) {
        console.error("No active tournament loaded.");
        return false;
    }

    try {
        // Query the tournaments table for this specific tournament's password
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?id=eq.${activeTournamentId}&select=admin_password`, { headers });
        const data = await res.json();
        
        if (!data || data.length === 0) return false;
        
        // Check if the input matches the database password
        return data[0].admin_password === passwordAttempt;
    } catch (err) {
        console.error("Auth check failed:", err);
        return false;
    }
}

export async function adminInsertPool(poolName, siteName) {
    if (!activeTournamentId) {
        await getActiveTournament();
        if (!activeTournamentId) {
            console.error("Error: The app does not know which tournament is active!");
            return false;
        }
    }

    try {
        // Generate a 100% unique ID right here in the app!
        const uniqueId = crypto.randomUUID();

        const payload = { 
            id: uniqueId,   // Sends the unique string to your text column
            name: poolName, // The friendly name (e.g., "Pool 1")
            site: siteName,
            tournament_id: activeTournamentId 
        };
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pools`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=minimal' 
            },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errorDetails = await res.text();
            console.error("Supabase Database Error Details:", errorDetails);
            return false;
        }
        
        return true;
    } catch (err) {
        console.error("Network Error creating pool:", err);
        return false;
    }
}

// --- POOL MANAGEMENT ---
export async function adminUpdatePool(poolId, newName, newSite) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pools?id=eq.${poolId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: newName, site: newSite })
        });
        return res.ok;
    } catch (err) {
        console.error("Error updating pool:", err);
        return false;
    }
}

export async function adminDeletePool(poolId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pools?id=eq.${poolId}`, {
            method: 'DELETE',
            headers: headers
        });
        return res.ok;
    } catch (err) {
        console.error("Error deleting pool:", err);
        return false;
    }
}

export async function adminUploadLogo(file) {
    if (!file) return null;
    
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
        
        // NEW: Force Supabase to tell us exactly why it rejected the image!
        if (!res.ok) {
            const errorDetails = await res.text();
            console.error("Supabase Storage Error Details:", errorDetails);
            throw new Error('Upload failed');
        }
        
        return `${SUPABASE_URL}/storage/v1/object/public/logos/${uniqueFileName}`;
    } catch (err) {
        console.error("Logo upload error:", err);
        return null;
    }
}

export async function adminInsertTeam(teamName, color, logoUrl) {
    if (!activeTournamentId) {
        await getActiveTournament();
        if (!activeTournamentId) {
            console.error("Error: Active tournament not found!");
            return false;
        }
    }

    try {
        const uniqueId = crypto.randomUUID();

        const payload = { 
            id: uniqueId, 
            name: teamName, 
            color: color, 
            logo_id: logoUrl, // <-- CHANGED: Now matches your database perfectly!
            tournament_id: activeTournamentId 
        };
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorDetails = await res.text();
            console.error("Supabase Database Error (Teams):", errorDetails);
            return false;
        }
        
        return true;
    } catch (err) {
        console.error("Error creating team:", err);
        return false;
    }
}

export async function adminBulkUpdateTeamPools(teamUpdates) {
    try {
        // teamUpdates is an array of { id: 'team_uuid', pool_id: 'pool_uuid', seed: 1 }
        const promises = teamUpdates.map(team => 
            fetch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${team.id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ 
                    pool_id: team.pool_id,
                    seed: team.seed  // <--- WE JUST ADDED THIS LINE
                })
            })
        );
        
        const results = await Promise.all(promises);
        
        // Ensure every single save was successful
        return results.every(res => res.ok);
    } catch (err) {
        console.error("Error saving team assignments:", err);
        return false;
    }
}

// --- SUPER ADMIN FUNCTIONS ---
export async function fetchAllTournaments() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?select=*`, { headers });
        if (!res.ok) throw new Error("Failed to fetch tournaments");
        return await res.json();
    } catch (err) {
        console.error("Error fetching tournaments:", err);
        return [];
    }
}

export async function adminCreateTournament(slug, name, date, location, status, themeColor) {
    try {
        const payload = { 
            slug: slug,       // Matches your 'slug' column
            name: name, 
            date: date,       // Matches the new 'date' column you just added
            location: location, // Matches the new 'location' column
            status: status ,
            theme_color: themeColor // Matches the new 'theme_color' column
            // We do NOT send 'id' or 'created_at'—Supabase generates those automatically!
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=minimal' 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorDetails = await res.text();
            console.error("Supabase rejected the insert. Details:", errorDetails);
            return false;
        }

        return true;
    } catch (err) {
        console.error("Error creating tournament:", err);
        return false;
    }
}

// --- SUPER ADMIN AUTH ---
export async function verifySuperAdminPassword(passwordAttempt) {
    try {
        // Changed the table name in the URL to 'super_admins'
        const res = await fetch(`${SUPABASE_URL}/rest/v1/super_admins?select=password&limit=1`, { headers });
        const data = await res.json();
        
        if (!data || data.length === 0) return false;
        
        return data[0].password === passwordAttempt;
    } catch (err) {
        console.error("Super Admin auth check failed:", err);
        return false;
    }
}

// --- UPDATE TOURNAMENT INFO ---
export async function adminUpdateTournamentInfo(infoDataArray) {
    if (!activeTournamentId) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?id=eq.${activeTournamentId}`, {
            method: 'PATCH',
            headers: {
                ...headers,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ info_data: infoDataArray })
        });
        return res.ok;
    } catch (err) {
        console.error("Error updating tournament info:", err);
        return false;
    }
}

export async function getTournamentInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('t');
    
    if (!slug) return null;

    try {
        // CHANGED: Added 'name' to the select query
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?slug=eq.${slug}&select=info_data,theme_color,name`, { headers });
        const data = await res.json();
        
        if (data && data.length > 0) {
            return {
                info_data: data[0].info_data,
                theme_color: data[0].theme_color,
                name: data[0].name // CHANGED: Now passing the name back
            };
        }
        return null;
    } catch (err) {
        console.error("Error fetching tournament data:", err);
        return null;
    }
}

export async function adminBulkInsertMatches(matchesArray) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/matches`, {
            method: 'POST',
            headers: { 
                ...headers, 
                'Prefer': 'return=minimal' 
            },
            body: JSON.stringify(matchesArray)
        });
        
        if (!response.ok) {
            const errorDetails = await response.text();
            console.error("Supabase API Error:", errorDetails);
            return false;
        }
        
        return true;
    } catch (err) {
        console.error("Error saving match schedule:", err);
        return false;
    }
}