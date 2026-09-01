// uiSuperAdmin.js
import { supabase } from './supabaseClient.js';
import { switchView, loadTournamentDirectory } from './app.js';

// --- WIRE UP BUTTONS WHEN PAGE LOADS ---
document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createTournamentBtn');
    if (createBtn) {
        createBtn.addEventListener('click', superAdminCreateTournament);
    }

    const logoutBtn = document.getElementById('superAdminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutSuperAdmin);
    }
});

export async function attemptSuperAdminLogin() {
    const passwordAttempt = prompt("Enter Super Admin Password:");
    if (!passwordAttempt) return; 

    try {
        const { data, error } = await supabase
            .from('super_admins')
            .select('password')
            .limit(1)
            .single();
            
        if (error || !data) throw new Error("Could not verify credentials.");
        
        if (data.password === passwordAttempt) { 
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
        } else {
            alert("Access Denied.");
        }
    } catch (err) {
        console.error("Super Admin auth check failed:", err);
        alert("Access Denied.");
    }
}

export function logoutSuperAdmin() {
    switchView('landingView');
}

export async function superAdminCreateTournament() {
    const idInput = document.getElementById('newTourneyId');
    const nameInput = document.getElementById('newTourneyName');
    const dateInput = document.getElementById('newTourneyDate');
    const locInput = document.getElementById('newTourneyLoc');
    const statusInput = document.getElementById('newTourneyStatus');
    const colorInput = document.getElementById('newTournamentColor');

    const slug = idInput.value.trim().toLowerCase().replace(/\s+/g, '-'); 
    const name = nameInput.value.trim();

    if (!slug || !name) {
        alert("Tournament ID and Name are required!");
        return;
    }

    const createBtn = document.getElementById('createTournamentBtn');
    const originalText = createBtn.innerText;
    createBtn.innerText = "⏳ Creating...";
    createBtn.disabled = true;

    // --- EXACT CUSTOM INFO TEMPLATE ---
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
        
        const { error } = await supabase
            .from('tournaments')
            .insert([payload]);

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
    
    if (confirmInput !== "DELETE") {
        alert("Deletion cancelled.");
        return;
    }

    try {
        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert(`Tournament "${name}" has been deleted.`);
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
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false }); 
            
        if (error) throw error;
        
        list.innerHTML = '';
        tournaments.forEach(t => {
            const safeName = t.name.replace(/'/g, "\\'");

            list.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${t.theme_color || 'var(--accent-orange)'};"></div>
                            <strong style="color: var(--text-primary); display: block;">${t.name}</strong>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">URL: ?t=${t.slug}</span>
                        
                        <div style="display: flex; gap: 10px; align-items: center; margin-top: 6px;">
                            <label style="font-size: 0.75rem; color: var(--text-secondary);">Status:</label>
                            <select class="super-admin-status-select" data-id="${t.id}" style="padding: 4px 8px; border-radius: 4px; background: var(--surface-light); color: white; border: 1px solid var(--border-color); font-size: 0.75rem; cursor: pointer; outline: none; transition: border-color 0.3s;">
                                <option value="draft" ${t.status === 'draft' ? 'selected' : ''}>Draft</option>
                                <option value="published" ${t.status === 'published' ? 'selected' : ''}>Published</option>
                                <option value="active" ${t.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="archived" ${t.status === 'archived' ? 'selected' : ''}>Archived</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                        <a href="?t=${t.slug}" target="_blank" class="admin-btn" style="text-decoration: none; font-size: 0.8rem; background: var(--surface-light); color: white; padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border-color); text-align: center; width: 100%; box-sizing: border-box;">Enter ↗</a>
                        <button onclick="superAdminDeleteTournament('${t.id}', '${safeName}')" class="admin-btn" style="text-decoration: none; font-size: 0.8rem; background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 6px 12px; border-radius: 4px; cursor: pointer; text-align: center; width: 100%; box-sizing: border-box;">Delete</button>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Error fetching tournaments:", err);
        list.innerHTML = '<p style="color: var(--text-secondary);">Failed to load tournaments.</p>';
    }
}

// Global listener for the status dropdown changes
document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('super-admin-status-select')) {
        const tournamentId = e.target.dataset.id;
        const newStatus = e.target.value;
        const dropdown = e.target;
        
        // Visual indicator that it's saving
        dropdown.style.borderColor = 'var(--accent-orange)';

        const { error } = await supabase
            .from('tournaments')
            .update({ status: newStatus })
            .eq('id', tournamentId);

        if (error) {
            alert("Error updating status: " + error.message);
            dropdown.style.borderColor = '#ef4444'; // Red error border
        } else {
            // Flash green for success, then return to normal
            dropdown.style.borderColor = '#22c55e'; 
            setTimeout(() => {
                dropdown.style.borderColor = 'var(--border-color)';
            }, 2000);
        }
    }
});

window.attemptSuperAdminLogin = attemptSuperAdminLogin;
window.logoutSuperAdmin = logoutSuperAdmin;
window.superAdminCreateTournament = superAdminCreateTournament;
window.superAdminDeleteTournament = superAdminDeleteTournament;