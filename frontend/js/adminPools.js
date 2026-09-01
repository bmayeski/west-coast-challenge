// adminPools.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, setTeams, getTeams, setPools, getPools } from './state.js';

export function initPools() {
    const addTeamBtn = document.getElementById('addTeamBtn');
    if (addTeamBtn) addTeamBtn.addEventListener('click', handleAddTeam);

    const createPoolBtn = document.getElementById('createPoolBtn');
    if (createPoolBtn) createPoolBtn.addEventListener('click', handleAddPool);

    const savePoolsBtn = document.getElementById('savePoolsBtn');
    if (savePoolsBtn) savePoolsBtn.addEventListener('click', savePoolAssignments);
}

export async function loadTeams() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    // Fetch pools and teams concurrently using the new client
    const [poolsRes, teamsRes] = await Promise.all([
        supabase.from('pools').select('*').eq('tournament_id', tournamentId).order('name'),
        // Explicitly tell Supabase to order the teams by their seed
        supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('seed', { ascending: true })
    ]);

    if (poolsRes.error) console.error("Error fetching pools:", poolsRes.error);
    if (teamsRes.error) console.error("Error fetching teams:", teamsRes.error);

    let fetchedTeams = teamsRes.data || [];
    
    // Secondary fallback sort to perfectly mirror your public standings view
    fetchedTeams.sort((a, b) => {
        const seedA = a.seed !== null ? a.seed : 99;
        const seedB = b.seed !== null ? b.seed : 99;
        
        if (seedA !== seedB) return seedA - seedB;
        return a.name.localeCompare(b.name);
    });

    setPools(poolsRes.data || []);
    setTeams(fetchedTeams);
    
    renderPoolAssignmentGrid();
}

function renderPoolAssignmentGrid() {
    const grid = document.getElementById('adminPoolAssignmentGrid');
    if (!grid) return;

    const pools = getPools();
    const teams = getTeams();

    grid.innerHTML = '';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    grid.style.gap = '15px';

    // 1. Unassigned Container
    const unassignedDiv = document.createElement('div');
    unassignedDiv.className = 'data-card';
    unassignedDiv.style.cssText = 'padding: 15px; background: var(--surface-dark); border: 1px dashed var(--border-color);';
    unassignedDiv.innerHTML = `
        <h4 style="margin-top: 0; color: var(--text-secondary);">Unassigned Teams</h4>
        <div id="pool-unassigned" class="pool-list" style="min-height: 100px; display: flex; flex-direction: column; gap: 8px;"></div>
    `;
    grid.appendChild(unassignedDiv);

    // 2. Dynamic Pool Containers
    pools.forEach(pool => {
        const poolDiv = document.createElement('div');
        poolDiv.className = 'data-card';
        poolDiv.style.cssText = 'padding: 15px; background: var(--surface-dark);';
        poolDiv.innerHTML = `
            <h4 style="margin-top: 0; color: var(--accent-orange);">${pool.name}</h4>
            <div id="pool-${pool.id}" class="pool-list" data-pool-id="${pool.id}" style="min-height: 100px; display: flex; flex-direction: column; gap: 8px;"></div>
        `;
        grid.appendChild(poolDiv);
    });

    // 3. Distribute Teams
    teams.forEach(team => {
        const teamEl = document.createElement('div');
        teamEl.className = 'team-card cursor-grab';
        // Updated styling to space items between left (name) and right (buttons)
        teamEl.style.cssText = 'padding: 10px; background: var(--surface-light); border: 1px solid var(--border-color); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
        teamEl.dataset.id = team.id;

        // Escape single quotes in names so it doesn't break the javascript onclick function
        const safeName = team.name.replace(/'/g, "\\'");
        
        // Use the logo if available, otherwise fallback to the color square
        const logoHtml = team.logo_id 
            ? `<img src="${team.logo_id}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: contain; flex-shrink: 0;">` 
            : `<div style="width: 20px; height: 20px; border-radius: 4px; background: ${team.color || '#3b82f6'}; flex-shrink: 0;"></div>`;

        teamEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                ${logoHtml}
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">${team.name}</span>
            </div>
            
            <div style="display: flex; gap: 8px; flex-shrink: 0;">
                <button onclick="openEditTeamModal('${team.id}', '${safeName}', '${team.color}', '${team.logo_id}')" style="background: none; border: none; color: var(--accent-orange); cursor: pointer; font-size: 0.85rem;" title="Edit">
                    ✏️
                </button>
                <button onclick="deleteTeam('${team.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem;" title="Delete">
                    🗑️
                </button>
            </div>
        `;

        // Uses the correct pool_id from your database schema
        const targetContainer = team.pool_id ? document.getElementById(`pool-${team.pool_id}`) : document.getElementById('pool-unassigned');
        if (targetContainer) targetContainer.appendChild(teamEl);
    });

    // 4. Hook up SortableJS to all generated lists
    document.querySelectorAll('.pool-list').forEach(container => {
        new Sortable(container, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
    });
}

async function handleAddTeam() {
    const teamInput = document.getElementById('newTeamName');
    const colorInput = document.getElementById('newTeamColor');
    const logoInput = document.getElementById('newTeamLogo');
    const preview = document.getElementById('logoPreview');
    const teamName = teamInput.value.trim();
    const tournamentId = getTournamentId();

    if (!teamName || !tournamentId) return;

    let logoUrl = null;
    const file = logoInput.files[0];

    // 1. Upload to Supabase Storage if a file was selected
    if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${tournamentId}/${fileName}`; // Groups images by tournament

        // Change 'logos' if your Supabase bucket has a different name!
        const { error: uploadError } = await supabase.storage
            .from('logos') 
            .upload(filePath, file);

        if (uploadError) {
            alert("Error uploading logo: " + uploadError.message);
            return; 
        }

        // Generate the public URL to save in the database
        const { data: publicUrlData } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath);
            
        logoUrl = publicUrlData.publicUrl;
    }

    // 2. Save the team to the database with the new URL
    const { error } = await supabase
        .from('teams')
        .insert([{ 
            id: crypto.randomUUID(), 
            name: teamName, 
            color: colorInput.value,
            logo_id: logoUrl, 
            tournament_id: tournamentId 
        }]);

    if (error) {
        alert("Error adding team: " + error.message);
    } else {
        // Reset form
        teamInput.value = '';
        colorInput.value = '#3b82f6';
        logoInput.value = '';
        preview.src = '';
        preview.style.display = 'none';
        loadTeams();
    }
}

async function handleAddPool() {
    const poolInput = document.getElementById('newPoolName');
    const siteInput = document.getElementById('newPoolSite');
    const tournamentId = getTournamentId();

    if (!poolInput.value.trim() || !tournamentId) return;

    const { error } = await supabase
        .from('pools')
        .insert([{ 
            id: crypto.randomUUID(), 
            name: poolInput.value.trim(), 
            site: siteInput.value.trim(), 
            tournament_id: tournamentId 
        }]);

    if (error) {
        alert("Error adding pool: " + error.message);
    } else {
        poolInput.value = '';
        siteInput.value = '';
        loadTeams(); 
    }
}

async function savePoolAssignments() {
    const updates = [];
    
    document.querySelectorAll('.pool-list').forEach(container => {
        const poolId = container.dataset.poolId || null; 
        
        Array.from(container.children).forEach((teamEl, index) => {
            updates.push({
                id: teamEl.dataset.id,
                pool_id: poolId,
                seed: index + 1
            });
        });
    });

    if (updates.length === 0) return;

    // Send the updates concurrently to Supabase
    const promises = updates.map(update => 
        supabase.from('teams').update({ pool_id: update.pool_id, seed: update.seed }).eq('id', update.id)
    );

    const results = await Promise.all(promises);
    const hasError = results.some(res => res.error);
    
    if (hasError) {
        alert("There was an error saving some pool assignments.");
    } else {
        alert("Pools saved successfully!");
        loadTeams();
    }
}

// --- EDIT TEAM & DELETE TEAM GLOBAL FUNCTIONS ---

// 1. Opens the modal and populates current data
window.openEditTeamModal = (id, name, color, logoUrl) => {
    document.getElementById('editTeamId').value = id;
    document.getElementById('editTeamName').value = name;
    document.getElementById('editTeamColor').value = color || '#3b82f6';
    
    const preview = document.getElementById('editLogoPreview');
    if (logoUrl && logoUrl !== 'null' && logoUrl !== 'undefined') {
        preview.src = logoUrl;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
    
    document.getElementById('editTeamLogo').value = ''; 
    document.getElementById('editTeamModal').style.display = 'flex';
};

// 2. Delete team function
window.deleteTeam = async (id) => {
    // Prevent accidental clicks
    if (!confirm("Are you sure you want to delete this team? If they are already scheduled in matches, it may cause empty slots.")) {
        return;
    }
    
    const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);
        
    if (error) {
        alert("Error deleting team: " + error.message);
    } else {
        loadTeams(); // Instantly refresh the UI
    }
};

// --- GLOBAL EVENT LISTENERS (Bulletproof Event Delegation) ---

// Handle image preview painting for both Add and Edit inputs
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'newTeamLogo') {
        const file = e.target.files[0];
        const preview = document.getElementById('logoPreview');
        if (preview && file) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        } else if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
    } else if (e.target && e.target.id === 'editTeamLogo') {
        const file = e.target.files[0];
        const preview = document.getElementById('editLogoPreview');
        if (preview && file) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        } else if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
    }
});

// Handle Modal Save and Cancel buttons
document.addEventListener('click', async (e) => {
    // Close Modal
    if (e.target && e.target.id === 'cancelEditTeamBtn') {
        const modal = document.getElementById('editTeamModal');
        if (modal) modal.style.display = 'none';
    }

    // Save Changes
    if (e.target && e.target.id === 'saveEditTeamBtn') {
        const id = document.getElementById('editTeamId').value;
        const name = document.getElementById('editTeamName').value.trim();
        const color = document.getElementById('editTeamColor').value;
        const fileInput = document.getElementById('editTeamLogo');
        const saveBtn = e.target;
        const tournamentId = getTournamentId();

        if (!name) return alert("Team name is required.");
        saveBtn.innerText = 'Saving...';

        const updatePayload = { name, color };
        const file = fileInput.files[0];

        // If a new logo was uploaded, process it first
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${tournamentId}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);
            if (uploadError) {
                alert("Upload failed: " + uploadError.message);
                saveBtn.innerText = 'Save Changes';
                return;
            }

            const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
            updatePayload.logo_id = data.publicUrl;
        }

        const { error } = await supabase.from('teams').update(updatePayload).eq('id', id);

        if (error) {
            alert("Error updating team: " + error.message);
        } else {
            document.getElementById('editTeamModal').style.display = 'none';
            loadTeams(); // Refresh the list
        }
        
        saveBtn.innerText = 'Save Changes';
    }
});