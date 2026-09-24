// uiSuperAdmin.js
import { supabase } from './supabaseClient.js';
import { switchView, loadTournamentDirectory } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createTournamentBtn');
    if (createBtn) createBtn.addEventListener('click', superAdminCreateTournament);

    const logoutBtn = document.getElementById('superAdminLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutSuperAdmin);
});

export async function attemptSuperAdminLogin() {
    const passwordAttempt = prompt("Enter Super Admin Password:");
    if (!passwordAttempt) return; 

    try {
        const { error: authErr } = await supabase.auth.signInAnonymously();
        if (authErr) throw authErr;

        const { data: isMaster, error: rpcErr } = await supabase.rpc('authorize_master', {
            p_password: passwordAttempt
        });

        if (rpcErr || !isMaster) {
            await supabase.auth.signOut(); 
            alert("Access Denied.");
            return;
        }

        window.isSuperAdmin = true;

        document.querySelectorAll('.view-section').forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });
        
        const masterView = document.getElementById('masterAdminView');
        if (masterView) {
            masterView.style.display = 'block';
            masterView.classList.add('active');
        }
        
        renderSuperAdminTournamentList();
    } catch (err) {
        console.error("Super Admin auth check failed:", err);
        await supabase.auth.signOut();
        alert("Access Denied.");
    }
}

export async function logoutSuperAdmin() {
    await supabase.auth.signOut();
    window.isSuperAdmin = false;
    switchView('landingView');
}

export async function superAdminCreateTournament() {
    const idInput = document.getElementById('newTourneyId');
    const nameInput = document.getElementById('newTourneyName');
    const dateInput = document.getElementById('newTourneyDate');
    const locInput = document.getElementById('newTourneyLoc');
    const statusInput = document.getElementById('newTourneyStatus');
    const colorInput = document.getElementById('newTournamentColor');

    const slug = idInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); 
    const name = nameInput.value.trim();

    if (!slug || !name) {
        alert("Tournament ID and Name are required!");
        return;
    }

    const createBtn = document.getElementById('createTournamentBtn');
    const originalText = createBtn.innerText;
    createBtn.innerText = "⏳ Creating...";
    createBtn.disabled = true;

    const defaultInfoData = [
        { "icon": "📍", "title": "Locations & Schedule", "content": "<p><strong style=\"color: rgb(255, 255, 255);\">[Friday, Date] - Pool Play</strong></p><ul><li><strong>[Host High School]</strong> ([Host Gym Address]): Gym opens at [Time] PM. Play at [Time] PM.</li><li><strong>[Second High School]</strong> ([Second Gym Address]): Gym opens at [Time] PM. Play at [Time] PM.</li><li>It is imperative that all teams are ready to play/ref on time. The next match starts immediately as the previous match ends.</li></ul><p><strong style=\"color: rgb(255, 255, 255);\">[Saturday, Date] - Playoffs</strong></p><ul><li><strong>All Gyms</strong> will be ready to open at [Time] AM. Play begins at [Time] AM.</li></ul>", "isSubBox": false },
        { "icon": "🎟️", "title": "Admission & Concessions", "content": "<ul><li><strong>Spectator Entry Fee:</strong> $10 for Adults, $5 for Senior Citizens. Students/Kids are FREE. (Charged each day).</li><li><strong>Payment:</strong> Please ask your parents to bring <strong>cash</strong>.</li><li><strong>Snack Bar:</strong> Available at all sites (cash preferred).</li></ul>", "isSubBox": false },
        { "icon": "⛺", "title": "Team Camps & Facilities", "content": "<ul><li>You can set up a camp outside to hang out. Feel free to bring food.</li><li><strong style=\"color: rgb(240, 102, 102);\">NO Grills or cooking</strong> will be allowed.</li><li>Please help make sure to clean up your campsite after your team is done playing!</li></ul>", "isSubBox": false },
        { "icon": "🏐", "title": "Match Format & Rules", "content": "<ul><li>Please<strong> bring your own balls</strong> for warm-ups.</li><li>There will be <strong>NO \"shared\" hitting or serving</strong> at any time.</li><li><strong>Warm-ups: </strong>6 minutes before your 1st match of the day; 4 minutes for all subsequent matches.</li><li><strong>Scoring:</strong> ALL matches are best of three. First two sets are rally-scored to 25. Third set (if required) is rally to 15. No cap on any sets.</li></ul>", "isSubBox": false },
        { "icon": "", "title": "", "content": "<p><strong style=\"color: rgb(255, 255, 255);\">Tie-Breaker Rules:</strong></p><ul><li><strong>Two-way ties:</strong> broken by head-to-head.</li><li><strong>Three-way ties:</strong> broken via set ratio, then point ratio (head-to-head is not a factor).</li></ul>", "isSubBox": true },
        { "icon": "🏆", "title": "Saturday Playoff Breakdown", "content": "<ul><li><strong>1st &amp; 2nd Place</strong> from Friday pools compete in the <strong>GOLD </strong>division at [Host High School].</li><li><strong>3rd &amp; 4th Place</strong> from Friday pools compete in the <strong>SILVER </strong>division at [Second High School].</li><li>First-round playoff matches on Saturday are for<strong> SEEDING ONLY</strong>. Single elimination begins after the seeding round!</li></ul>", "isSubBox": false },
        { "icon": "📊", "title": "Tournament Seeding", "content": "<p>Seeding was done by CIF Divisions as there were no matches to evaluate at this time. After that, we had to consider teams from the same league and other conflicts to set the initial pools.</p>", "isSubBox": false },
        { "icon": "⚖️", "title": "Officiating Duties", "content": "<ul><li>Please be ready to officiate when it is your turn, but we will try to provide a scorebook person.</li><li><strong>Friday:</strong> Sitting teams may be asked to help line/score during pool play.</li><li><strong>Saturday:</strong> Teams will be asked to officiate or assist in officiating the first round of matches.</li></ul><p><br></p><h6><span style=\"color: rgb(240, 102, 102);\">LOSING TEAMS WILL BE ASKED TO STAY AND OFFICIATE MATCHES ON SATURDAY!</span></h6>", "isSubBox": false },
        { "icon": "", "title": "", "content": "<p class=\"ql-align-center\"><strong style=\"color: rgb(242, 105, 34);\">Come ready to play some volleyball and have some fun!</strong></p>", "isSubBox": false },
        { "icon": "📞", "title": "Tournament Director", "content": "<p class=\"ql-align-center\"><strong style=\"color: rgb(255, 255, 255); font-size: 20px;\" class=\"ql-size-large\">[Director Name]</strong></p><p class=\"ql-align-center\">📧<span style=\"color: rgb(242, 105, 34);\"> [Director Email]</span></p><p class=\"ql-align-center\">📱 [Director Phone]</p>", "isSubBox": false }
    ];

    try {
        const payload = { 
            slug: slug, 
            name: name, 
            date: dateInput.value.trim(), 
            location: locInput.value.trim(), 
            status: statusInput.value,
            theme_color: colorInput.value,
            info_data: defaultInfoData 
        };
        
        const { error } = await supabase.from('tournaments').insert([payload]);
        if (error) throw error;

        alert(`Tournament "${name}" created successfully!`);
        
        idInput.value = ''; nameInput.value = ''; dateInput.value = ''; locInput.value = '';
        if (colorInput) colorInput.value = '#F26922'; 
        
        renderSuperAdminTournamentList();
        loadTournamentDirectory();
    } catch (err) {
        console.error("Error creating tournament:", err);
        alert("Failed to create tournament. Ensure the URL ID is unique.");
    } finally {
        createBtn.innerText = originalText;
        createBtn.disabled = false;
    }
}

export async function superAdminDeleteTournament(id, name) {
    const confirmInput = prompt(`WARNING: You are about to permanently delete "${name}".\n\nThis will remove it from the directory. To confirm, type the word DELETE in all caps:`);
    if (confirmInput !== "DELETE") return;

    try {
        const { error } = await supabase.from('tournaments').delete().eq('id', id);
        if (error) throw error;
        renderSuperAdminTournamentList();
        loadTournamentDirectory();
    } catch (err) {
        console.error("Error deleting tournament:", err);
        alert("Failed to delete tournament. " + err.message);
    }
}

export async function renderSuperAdminTournamentList() {
    const list = document.getElementById('superAdminTournamentList');
    if (!list) return;

    list.innerHTML = '<p style="color: var(--text-secondary);">Loading...</p>';
    
    try {
        const { data: tournaments, error } = await supabase.from('tournaments').select('*'); 
        if (error) throw error;
        
        const groups = {
            active: { title: '🟢 Active Tournaments', items: [], open: true },
            published: { title: '🟠 Published', items: [], open: true },
            draft: { title: '⚪ Drafts', items: [], open: true },
            completed: { title: '🔵 Completed', items: [], open: false },
            archived: { title: '📁 Archived', items: [], open: false }
        };

        tournaments.forEach(t => {
            if (groups[t.status]) groups[t.status].items.push(t);
            else groups.draft.items.push(t);
        });
        
        list.innerHTML = '';
        
        for (const [status, group] of Object.entries(groups)) {
            if (group.items.length === 0) continue;
            
            group.items.sort((a, b) => {
                const dateA = new Date(a.date || '2099-01-01').getTime();
                const dateB = new Date(b.date || '2099-01-01').getTime();
                return dateA - dateB;
            });
            
            // REDUCED margin-bottom from 15px to 8px
            let groupHTML = `
                <details ${group.open ? 'open' : ''} style="margin-bottom: 8px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--border-color);">
                    <!-- REDUCED padding from 12px 15px to 8px 12px -->
                    <summary style="padding: 8px 12px; font-weight: bold; cursor: pointer; color: var(--text-primary); list-style: none; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                        ${group.title} <span style="font-size: 0.8rem; color: var(--text-secondary); background: var(--surface-light); padding: 2px 10px; border-radius: 12px;">${group.items.length}</span>
                    </summary>
                    <div style="padding: 8px 10px;">
            `;

            group.items.forEach(t => {
                const safeName = t.name.replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                groupHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: stretch; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px;">
                        
                        <!-- LEFT SIDE: Inputs Column -->
                        <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 10px; flex: 1; min-width: 0; padding-right: 20px;">
                            
                            <!-- ROW 1: Name -->
                            <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${t.theme_color || 'var(--accent-orange)'}; flex-shrink: 0;"></div>
                                <input type="text" class="super-admin-name-input" data-id="${t.id}" value="${safeName}" style="background: var(--surface-dark); color: var(--text-primary); border: 1px solid var(--border-color); font-weight: bold; font-size: 1rem; outline: none; transition: border-color 0.3s; padding: 4px 8px; border-radius: 4px; flex: 1; min-width: 0;" placeholder="Tournament Name">
                            </div>
                            
                            <!-- ROW 2: URL & Admin Pass -->
                            <div style="display: flex; align-items: center; gap: 20px; width: 100%;">
                                <div style="display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;">
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">URL: ?t=</span>
                                    <input type="text" class="super-admin-slug-input" data-id="${t.id}" value="${t.slug}" style="background: var(--surface-dark); color: var(--text-secondary); border: 1px solid var(--border-color); font-size: 0.75rem; outline: none; transition: border-color 0.3s; padding: 4px 8px; border-radius: 4px; flex: 1; min-width: 0;" placeholder="url-slug">
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center; flex: 1; min-width: 0;">
                                    <label style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">Admin Pass:</label>
                                    <input type="text" class="super-admin-password-input" data-id="${t.id}" value="${t.admin_password || ''}" placeholder="Set password..." style="padding: 4px 8px; border-radius: 4px; background: var(--surface-light); color: white; border: 1px solid var(--border-color); font-size: 0.75rem; flex: 1; min-width: 0; outline: none; transition: border-color 0.3s;">
                                </div>
                            </div>
                            
                            <!-- ROW 3: Status, Date, Loc -->
                            <div style="display: flex; gap: 10px; align-items: center; width: 100%;">
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <label style="font-size: 0.75rem; color: var(--text-secondary);">Status:</label>
                                    <select class="super-admin-status-select" data-id="${t.id}" style="padding: 4px 8px; border-radius: 4px; background: var(--surface-light); color: white; border: 1px solid var(--border-color); font-size: 0.75rem; cursor: pointer; outline: none; transition: border-color 0.3s;">
                                        <option value="draft" ${t.status === 'draft' ? 'selected' : ''}>Draft</option>
                                        <option value="published" ${t.status === 'published' ? 'selected' : ''}>Published</option>
                                        <option value="active" ${t.status === 'active' ? 'selected' : ''}>Active</option>
                                        <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
                                        <option value="archived" ${t.status === 'archived' ? 'selected' : ''}>Archived</option>
                                    </select>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <label style="font-size: 0.75rem; color: var(--text-secondary);">Date:</label>
                                    <input type="text" class="super-admin-date-input" data-id="${t.id}" value="${t.date || ''}" placeholder="Date..." style="padding: 4px 8px; border-radius: 4px; background: var(--surface-light); color: white; border: 1px solid var(--border-color); font-size: 0.75rem; width: 60px; outline: none; transition: border-color 0.3s;">
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center; flex: 1; min-width: 0;">
                                    <label style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">Loc:</label>
                                    <input type="text" class="super-admin-loc-input" data-id="${t.id}" value="${t.location || ''}" placeholder="Location..." style="padding: 4px 8px; border-radius: 4px; background: var(--surface-light); color: white; border: 1px solid var(--border-color); font-size: 0.75rem; flex: 1; min-width: 0; outline: none; transition: border-color 0.3s;">
                                </div>
                            </div>
                        </div>
                        
                        <!-- RIGHT SIDE: Buttons Column -->
                        <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 10px; min-width: 130px;">
                            <a href="?t=${t.slug}" target="_blank" class="admin-btn" style="display: flex; align-items: center; justify-content: center; flex: 1; text-decoration: none; font-size: 0.8rem; background: var(--surface-light); color: white; padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); text-align: center; width: 100%; box-sizing: border-box;">Enter ↗</a>
                            <button onclick="superAdminDuplicateTournament('${t.id}', '${safeName.replace(/'/g, "\\'")}')" class="admin-btn" style="display: flex; align-items: center; justify-content: center; flex: 1; text-decoration: none; font-size: 0.8rem; background: transparent; color: #3b82f6; border: 1px solid #3b82f6; padding: 4px; border-radius: 4px; cursor: pointer; text-align: center; width: 100%; box-sizing: border-box;">Duplicate</button>
                            <button onclick="superAdminDeleteTournament('${t.id}', '${safeName.replace(/'/g, "\\'")}')" class="admin-btn" style="display: flex; align-items: center; justify-content: center; flex: 1; text-decoration: none; font-size: 0.8rem; background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 4px; border-radius: 4px; cursor: pointer; text-align: center; width: 100%; box-sizing: border-box;">Delete</button>
                        </div>
                    </div>
                `;
            });

            groupHTML += `</div></details>`;
            list.innerHTML += groupHTML;
        }
    } catch (err) {
        console.error("Error fetching tournaments:", err);
        list.innerHTML = '<p style="color: var(--text-secondary);">Failed to load tournaments.</p>';
    }
}

document.addEventListener('change', async (e) => {
    
    const attemptUpdate = async (field, payload, tournamentId, isStatus = false) => {
        field.style.borderColor = 'var(--accent-orange)';
        
        const { error } = await supabase.from('tournaments').update(payload).eq('id', tournamentId);
        
        if (error) {
            field.style.borderColor = '#ef4444';
            let msg = error.message;
            if (error.code === '23505') msg = "That URL is already taken by another tournament.";
            alert("Update Failed: " + msg);
            if (isStatus) renderSuperAdminTournamentList(); 
            return;
        }

        field.style.borderColor = '#22c55e';
        setTimeout(() => { field.style.borderColor = 'var(--border-color)'; }, 2000);
        
        if (isStatus) renderSuperAdminTournamentList(); 
    };

    const tId = e.target.dataset.id;
    if (!tId) return;

    if (e.target.classList.contains('super-admin-status-select')) await attemptUpdate(e.target, { status: e.target.value }, tId, true);
    if (e.target.classList.contains('super-admin-date-input')) await attemptUpdate(e.target, { date: e.target.value.trim() }, tId);
    if (e.target.classList.contains('super-admin-loc-input')) await attemptUpdate(e.target, { location: e.target.value.trim() }, tId);
    if (e.target.classList.contains('super-admin-password-input')) await attemptUpdate(e.target, { admin_password: e.target.value.trim() }, tId);
    if (e.target.classList.contains('super-admin-name-input')) await attemptUpdate(e.target, { name: e.target.value.trim() }, tId);
    
    if (e.target.classList.contains('super-admin-slug-input')) {
        let cleanSlug = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        e.target.value = cleanSlug;
        await attemptUpdate(e.target, { slug: cleanSlug }, tId);
    }
});

export async function superAdminDuplicateTournament(oldTournamentId, oldName) {
    const newName = prompt(`Create a copy of "${oldName}"\n\nEnter the name for the new tournament:`, `${oldName} (Copy)`);
    if (!newName) return;

    const defaultSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newSlug = prompt(`Enter the new URL ID (slug):\n(This must be unique)`, defaultSlug);
    if (!newSlug) return;

    try {
        const { data: oldTourney, error: tErr } = await supabase.from('tournaments').select('*').eq('id', oldTournamentId).single();
        if (tErr) throw new Error(`Tournament fetch failed: ${tErr.message}`);

        const newTourneyPayload = { ...oldTourney };
        delete newTourneyPayload.id; 
        delete newTourneyPayload.created_at; 
        newTourneyPayload.name = newName;
        newTourneyPayload.slug = newSlug;
        newTourneyPayload.status = 'draft'; 

        const { data: newTourney, error: ntErr } = await supabase.from('tournaments').insert([newTourneyPayload]).select().single();
        if (ntErr) throw new Error(`Tournament insert failed: ${ntErr.message}`);
        
        const newTournamentId = newTourney.id;
        const { data: oldPools } = await supabase.from('pools').select('*').eq('tournament_id', oldTournamentId);
        const poolMap = {}; 

        if (oldPools && oldPools.length > 0) {
            for (const p of oldPools) {
                const poolPayload = { ...p, tournament_id: newTournamentId };
                delete poolPayload.id;
                delete poolPayload.created_at;
                const { data: newPool, error: pErr } = await supabase.from('pools').insert([poolPayload]).select().single();
                if (pErr) throw new Error(`Pool insert failed for ${p.name}: ${pErr.message}`);
                if (newPool) poolMap[p.id] = newPool.id;
            }
        }

        const { data: oldTeams } = await supabase.from('teams').select('*').eq('tournament_id', oldTournamentId);
        if (oldTeams && oldTeams.length > 0) {
            const teamsToInsert = oldTeams.map(t => {
                const teamPayload = { ...t, tournament_id: newTournamentId };
                delete teamPayload.id;
                delete teamPayload.created_at;
                teamPayload.pool_id = (teamPayload.pool_id && poolMap[teamPayload.pool_id]) ? poolMap[teamPayload.pool_id] : null; 
                return teamPayload;
            });
            const { error: teamErr } = await supabase.from('teams').insert(teamsToInsert);
            if (teamErr) throw new Error(`Team insert failed: ${teamErr.message}`);
        }

        alert(`Success! "${newName}" has been created.`);
        renderSuperAdminTournamentList();
    } catch (error) {
        alert(`Duplication Error:\n${error.message}`);
    }
}

window.attemptSuperAdminLogin = attemptSuperAdminLogin;
window.logoutSuperAdmin = logoutSuperAdmin;
window.superAdminCreateTournament = superAdminCreateTournament;
window.superAdminDeleteTournament = superAdminDeleteTournament;
window.superAdminDuplicateTournament = superAdminDuplicateTournament;