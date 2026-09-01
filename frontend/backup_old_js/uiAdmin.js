import { verifyAdminPassword, adminInsertPool, adminUploadLogo, adminInsertTeam, getTournamentInfo, fetchDatabase, adminUpdatePool, adminDeletePool, adminBulkUpdateTeamPools, adminBulkInsertMatches } from './api.js';
import { renderPublicInfo, globalStandings } from './app.js';
// We will import silentRefresh later when we build the drag-and-drop grid!

let isAdminLoggedIn = false;

// --- LOGIN LOGIC ---
export function attemptAdminLogin() {
    if (isAdminLoggedIn) {
        window.switchView('adminView');
    } else {
        document.getElementById('adminPasswordInput').value = '';
        document.getElementById('adminLoginError').style.display = 'none';
        document.getElementById('adminLoginModal').style.display = 'flex'; 
        document.getElementById('adminPasswordInput').focus();
    }
}

export function closeAdminLogin() {
    document.getElementById('adminLoginModal').style.display = 'none'; 
}

export async function submitAdminLogin() {
    const inputField = document.getElementById('adminPasswordInput');
    const submitBtn = document.getElementById('adminSubmitBtn');
    const errorMsg = document.getElementById('adminLoginError');
    const password = inputField.value;

    if (!password) return;

    submitBtn.textContent = 'Checking...';
    submitBtn.disabled = true;

    const isValid = await verifyAdminPassword(password);

    if (isValid) {
        isAdminLoggedIn = true;
        closeAdminLogin();
        window.switchView('adminView');
        await loadAdminInfoEditor();
    } else {
        errorMsg.style.display = 'block';
        inputField.value = '';
        inputField.focus();
    }

    submitBtn.textContent = 'Unlock';
    submitBtn.disabled = false;
}

export function logoutAdmin() {
    isAdminLoggedIn = false;
    // window.switchView('infoView'); 
}

export function switchAdminSubView(viewId) {
    // 1. Hide all admin sub-views
    const subViews = document.querySelectorAll('.admin-sub-view');
    subViews.forEach(v => v.style.display = 'none');

    // 2. Remove the active class ONLY from buttons inside the admin navigation bar
    const adminNavButtons = document.querySelectorAll('#adminView .nav-btn');
    adminNavButtons.forEach(btn => btn.classList.remove('active'));

    // 3. Show the requested sub-view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
    }

    // 4. Add the orange highlight to the active button
    const targetBtn = document.getElementById('btn-' + viewId);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // 5. NEW: Trigger specific data loads when a tab is clicked!
    if (viewId === 'adminSetup' || viewId === 'setupView') { 
        renderAdminPoolsList();
        renderPoolAssignmentGrid(); // <--- ADD THIS LINE
    }
}

// --- SETUP DASHBOARD LOGIC ---
export async function adminAddPool() {
    const nameInput = document.getElementById('newPoolName');
    const siteInput = document.getElementById('newPoolSite');
    const name = nameInput.value.trim();
    const site = siteInput.value.trim();

    if (!name) { 
        alert("Pool name is required!"); 
        return; 
    }

    const success = await adminInsertPool(name, site);
    if (success) {
        alert(`Pool ${name} created successfully!`);
        nameInput.value = '';
        siteInput.value = '';
        renderAdminPoolsList();
        // TODO: Refresh the drag-and-drop grid here later
    } else {
        alert("Failed to create pool. Check the console for details.");
    }
}

export async function adminAddTeam() {
    const btn = document.getElementById('btn-addTeam');
    const nameInput = document.getElementById('newTeamName');
    const colorInput = document.getElementById('newTeamColor');
    const fileInput = document.getElementById('newTeamLogo');
    
    const name = nameInput.value.trim();
    const color = colorInput.value;
    const file = fileInput.files[0];

    if (!name) { 
        alert("Team name is required!"); 
        return; 
    }

    btn.disabled = true;
    
    let finalLogoUrl = null;
    if (file) {
        btn.textContent = 'Uploading Logo...';
        finalLogoUrl = await adminUploadLogo(file);
    }

    btn.textContent = 'Saving Team...';
    const success = await adminInsertTeam(name, color, finalLogoUrl);
    
    if (success) {
        alert(`Team ${name} added successfully!`);
        nameInput.value = '';
        colorInput.value = '#3b82f6';
        fileInput.value = '';
        
        // NEW: Hide the logo preview again!
        document.getElementById('logoPreviewContainer').style.display = 'none'; 
        
        renderPoolAssignmentGrid(); // Refreshes your new drag-and-drop grid!
    } else {
        alert("Failed to add team. Check the console for details.");
    }

    btn.disabled = false;
    btn.textContent = '+ Add Team';
}

import { adminUpdateTournamentInfo } from './api.js';

// --- EDIT INFO PAGE LOGIC ---
export function adminAddInfoSection(icon = "📋", title = "", content = "", isSubBox = false) {
    const list = document.getElementById('adminInfoSectionsList');
    
    const sectionCard = document.createElement('div');
    sectionCard.className = 'info-section-editor data-card';
    sectionCard.style.cssText = 'padding: 15px; background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; position: relative;';
    
    // We add a white background to the quill-wrapper so the editor is highly visible and the text is easy to read
    sectionCard.innerHTML = `
        <button onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: #BF2A39; color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; z-index: 10;">X</button>
        
        <div style="display: flex; gap: 10px; margin-bottom: 10px; padding-right: 40px; align-items: center;">
            <!-- NEW: The Drag Handle -->
            <span class="drag-handle" style="cursor: grab; font-size: 1.2rem; color: var(--text-secondary); padding-right: 5px;" title="Drag to reorder">☰</span>
            
            <input type="text" class="section-icon" value="${icon}" placeholder="Icon" style="width: 60px; padding: 8px; background: var(--bg-dark); border: 1px solid var(--border-color); color: white; border-radius: 4px; text-align: center;">
            <input type="text" class="section-title" value="${title}" placeholder="Section Title" style="flex: 1; padding: 8px; background: var(--bg-dark); border: 1px solid var(--border-color); color: white; border-radius: 4px;">
            <label style="color: var(--text-secondary); font-size: 0.85rem; display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" class="section-subbox" ${isSubBox ? 'checked' : ''}>
                🔗 Attach as Sub-Box
            </label>
        </div>
        
        <div class="quill-wrapper" style="border-radius: 4px;">
            <div class="quill-editor"></div>
        </div>
    `;
    
    list.appendChild(sectionCard);

    // 1. Force Quill to use inline CSS for Sizes and Alignment
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
    Quill.register(Size, true);

    const Align = Quill.import('attributors/style/align');
    Quill.register(Align, true);

    // 2. Define our massive custom color palette (Brand Colors + Standard Colors)
    const customColors = [
        '#FFFFFF', '#000000', '#F26922', '#BF2A39', '#151D28', // Your Theme Colors
        '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff', // Standard Colors
        '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
        '#bbbbbb', '#f06666', '#ffc266', '#ffff66', '#66b966', '#66a3e0', '#c285ff',
        '#888888', '#a10000', '#b26b00', '#b2b200', '#006100', '#0047b2', '#6b24b2',
        '#444444', '#5c0000', '#663d00', '#666600', '#003700', '#002966', '#3d1466'
    ];

    // 3. Initialize the highly customized Quill editor
    const editorDiv = sectionCard.querySelector('.quill-editor');
    const quill = new Quill(editorDiv, {
        theme: 'snow',
        modules: {
            toolbar: {
                container: [
                    [{ 'size': Size.whitelist }],
                    ['bold', 'italic', 'underline'],
                    // Feed our custom palette into the color and background tools
                    [{ 'color': customColors }, { 'background': customColors }],
                    [{ 'align': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }], 
                    [{ 'header': 6 }, 'blockquote'],
                    ['clean']
                ]
                // (We completely deleted the buggy "handlers" section that was blocking the menu!)
            }
        }
    });
    
    // 2. Load the existing content into the editor
    quill.root.innerHTML = content;
    
    // 3. Save the quill instance to the card so we can retrieve the text later
    sectionCard.quillInstance = quill;
}

export async function adminSaveInfo() {
    const sectionCards = document.querySelectorAll('.info-section-editor');
    const infoDataArray = [];

    sectionCards.forEach(card => {
        const icon = card.querySelector('.section-icon').value.trim();
        const title = card.querySelector('.section-title').value.trim();
        
        // Grab the generated HTML directly from Quill
        const content = card.quillInstance.root.innerHTML.trim();
        
        // Quill sets an empty box as <p><br></p>, so we ignore that
        const isSubBox = card.querySelector('.section-subbox').checked;
        if (title || (content && content !== '<p><br></p>')) {
            infoDataArray.push({ icon, title, content, isSubBox });
        }
    });

    const success = await adminUpdateTournamentInfo(infoDataArray);
    
    if (success) {
        alert("Info Page updated successfully!");
        // Instantly refresh the public view if the function exists in the current scope
        if (typeof renderPublicInfo === 'function') renderPublicInfo();
    } else {
        alert("Failed to save. Please try again.");
    }

    renderPublicInfo();
}

// Expose to HTML
window.adminAddInfoSection = adminAddInfoSection;
window.adminSaveInfo = adminSaveInfo;

export async function loadAdminInfoEditor() {
    const list = document.getElementById('adminInfoSectionsList');
    if (!list) return;
    
    list.innerHTML = ''; 
    
    const infoData = await getTournamentInfo();
    
    if (infoData && infoData.length > 0) {
        infoData.forEach(section => {
            adminAddInfoSection(section.icon, section.title, section.content, section.isSubBox);
        });
    } else {
        // 1. Locations & Schedule
        adminAddInfoSection("📍", "Locations & Schedule", `<p><strong style="color: rgb(255, 255, 255);">[Friday, Date] - Pool Play</strong></p><ul><li><strong>[Host High School]</strong> ([Host Gym Address]): Gym opens at [Time] PM. Play at [Time] PM.</li><li><strong>[Second High School]</strong> ([Second Gym Address]): Gym opens at [Time] PM. Play at [Time] PM.</li><li>It is imperative that all teams are ready to play/ref on time. The next match starts immediately as the previous match ends.</li></ul><p><strong style="color: rgb(255, 255, 255);">[Saturday, Date] - Playoffs</strong></p><ul><li><strong>All Gyms</strong> will be ready to open at [Time] AM. Play begins at [Time] AM.</li></ul>`, false);
        
        // 2. Admission & Concessions
        adminAddInfoSection("🎟️", "Admission & Concessions", `<ul><li><strong>Spectator Entry Fee:</strong> $10 for Adults, $5 for Senior Citizens. Students/Kids are FREE. (Charged each day).</li><li><strong>Payment:</strong> Please ask your parents to bring <strong>cash</strong>.</li><li><strong>Snack Bar:</strong> Available at all sites (cash preferred).</li></ul>`, false);

        // 3. Team Camps & Facilities
        adminAddInfoSection("⛺", "Team Camps & Facilities", `<ul><li>You can set up a camp outside to hang out. Feel free to bring food.</li><li><strong style="color: rgb(240, 102, 102);">NO Grills or cooking</strong> will be allowed.</li><li>Please help make sure to clean up your campsite after your team is done playing!</li></ul>`, false);
        
        // 4. Match Format & Rules
        adminAddInfoSection("🏐", "Match Format & Rules", `<ul><li>Please<strong> bring your own balls</strong> for warm-ups.</li><li>There will be <strong>NO "shared" hitting or serving</strong> at any time.</li><li><strong>Warm-ups: </strong>6 minutes before your 1st match of the day; 4 minutes for all subsequent matches.</li><li><strong>Scoring:</strong> ALL matches are best of three. First two sets are rally-scored to 25. Third set (if required) is rally to 15. No cap on any sets.</li></ul>`, false);

        // 5. Tie-Breaker Rules (SUB-BOX)
        adminAddInfoSection("", "", `<p><strong style="color: rgb(255, 255, 255);">Tie-Breaker Rules:</strong></p><ul><li><strong>Two-way ties:</strong> broken by head-to-head.</li><li><strong>Three-way ties:</strong> broken via set ratio, then point ratio (head-to-head is not a factor).</li></ul>`, true);

        // 6. Saturday Playoff Breakdown
        adminAddInfoSection("🏆", "Saturday Playoff Breakdown", `<ul><li><strong>1st &amp; 2nd Place</strong> from Friday pools compete in the <strong>GOLD </strong>division at [Host High School].</li><li><strong>3rd &amp; 4th Place</strong> from Friday pools compete in the <strong>SILVER </strong>division at [Second High School].</li><li>First-round playoff matches on Saturday are for<strong> SEEDING ONLY</strong>. Single elimination begins after the seeding round!</li></ul>`, false);

        // 7. Tournament Seeding
        adminAddInfoSection("📊", "Tournament Seeding", `<p>Seeding was done by CIF Divisions as there were no matches to evaluate at this time. After that, we had to consider teams from the same league and other conflicts to set the initial pools.</p>`, false);

        // 8. Officiating Duties
        adminAddInfoSection("⚖️", "Officiating Duties", `<ul><li>Please be ready to officiate when it is your turn, but we will try to provide a scorebook person.</li><li><strong>Friday:</strong> Sitting teams may be asked to help line/score during pool play.</li><li><strong>Saturday:</strong> Teams will be asked to officiate or assist in officiating the first round of matches.</li></ul><p><br></p><h6>🚨 <span style="color: rgb(240, 102, 102);">LOSING TEAMS WILL BE ASKED TO STAY AND OFFICIATE MATCHES ON SATURDAY!</span></h6>`, false);

        // 9. Floating Text Call to Action
        adminAddInfoSection("", "", `<p class="ql-align-center"><strong style="color: rgb(242, 105, 34);">Come ready to play some volleyball and have some fun!</strong></p>`, false);

        // 10. Tournament Director (Centered Header)
        adminAddInfoSection("📞", "Tournament Director", `<p class="ql-align-center"><strong style="color: rgb(255, 255, 255); font-size: 20px;" class="ql-size-large">[Director Name]</strong></p><p class="ql-align-center">📧<span style="color: rgb(242, 105, 34);"> [Director Email]</span></p><p class="ql-align-center">📱 [Director Phone]</p>`, false);
    }
    
    new Sortable(list, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost'
    });
}

// Expose to HTML/app.js
window.loadAdminInfoEditor = loadAdminInfoEditor;

export async function renderAdminPoolsList() {
    const container = document.getElementById('adminPoolsList');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--text-secondary);">Loading pools...</p>';

    const db = await fetchDatabase();
    
    if (!db.pools || db.pools.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No pools created yet.</p>';
        return;
    }

    container.innerHTML = '';
    
    // Sort pools alphabetically by name just to keep it clean
    const sortedPools = db.pools.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    sortedPools.forEach(pool => {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;';
        
        // Handle old data where name might be null
        const displayName = pool.name ? pool.name : pool.id; 
        const displaySite = pool.site ? pool.site : 'No location set';

        card.innerHTML = `
            <div>
                <strong style="color: var(--text-primary); display: block; font-size: 1.1rem;">${displayName}</strong>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">📍 ${displaySite}</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="admin-btn" onclick="editPool('${pool.id}', '${displayName}', '${displaySite}')">Edit</button>
                <button class="admin-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.5);" onclick="deletePool('${pool.id}')">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- ATTACH TO WINDOW FOR HTML ONCLICK ---
window.editPool = async (id, currentName, currentSite) => {
    const newName = prompt("Edit Pool Name:", currentName);
    if (newName === null || newName.trim() === '') return;
    
    const newSite = prompt("Edit Location:", currentSite);
    if (newSite === null) return;

    const success = await adminUpdatePool(id, newName.trim(), newSite.trim());
    if (success) {
        renderAdminPoolsList(); // Instantly redraw the list!
    } else {
        alert("Failed to update pool.");
    }
};

window.deletePool = async (id) => {
    if (!confirm("Are you sure you want to delete this pool? Teams inside it will become unassigned!")) return;
    
    const success = await adminDeletePool(id);
    if (success) {
        renderAdminPoolsList(); 
    } else {
        alert("Failed to delete pool.");
    }
};

export async function renderPoolAssignmentGrid() {
    const container = document.getElementById('adminPoolAssignmentGrid');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--text-secondary);">Loading grid...</p>';

    const db = await fetchDatabase();
    
    // 1. Better Filtering: Catch null, undefined, empty strings, and 'unassigned' text
    const unassignedTeams = db.teams.filter(t => !t.pool_id || t.pool_id === 'unassigned' || t.pool_id === 'null');
    
    // Default to an empty array if no pools exist yet so the code doesn't crash
    const poolsList = db.pools || []; 
    const poolsWithTeams = poolsList.map(pool => {
        return {
            ...pool,
            teams: db.teams.filter(t => t.pool_id === pool.id)
        };
    });

    // 2. ALWAYS Build the "Holding Pen" (even if zero pools exist)
    let html = `
        <div style="background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.1rem;">Unassigned Teams</h3>
            <div id="pool-unassigned" class="sortable-team-list" data-pool-id="unassigned" style="min-height: 60px; display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                ${unassignedTeams.map(t => createTeamBadge(t)).join('')}
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
    `;

    // 3. Build the Individual Pool Buckets (if any exist)
    if (poolsWithTeams.length === 0) {
        html += `<p style="color: var(--text-secondary); width: 100%; text-align: center;">Create a pool above to start assigning teams.</p>`;
    } else {
        poolsWithTeams.forEach(pool => {
            const poolName = pool.name ? pool.name : 'Unnamed Pool';
            html += `
                <div style="background: var(--surface-dark); border: 1px solid var(--border-color); border-top: 4px solid var(--accent-orange); border-radius: 8px; padding: 15px;">
                    <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.1rem; text-align: center;">${poolName}</h3>
                    <div class="sortable-team-list" data-pool-id="${pool.id}" style="min-height: 120px; display: flex; flex-direction: column; gap: 8px; padding: 10px; background: rgba(0,0,0,0.15); border-radius: 6px; border: 1px dashed transparent;">
                        ${pool.teams.map(t => createTeamBadge(t)).join('')}
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;

    // 4. Attach SortableJS to ALL buckets so they share items
    const lists = container.querySelectorAll('.sortable-team-list');
    lists.forEach(list => {
        new Sortable(list, {
            group: 'shared-pools', 
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
    });
}

function createTeamBadge(team) {
    return `
        <div class="draggable-team" data-team-id="${team.id}" style="background: var(--surface-lighter); border: 1px solid var(--border-color); border-left: 4px solid ${team.color || '#3b82f6'}; padding: 8px 12px; border-radius: 4px; color: var(--text-primary); font-weight: bold; cursor: grab; display: flex; justify-content: space-between; align-items: center; min-width: 140px;">
            <span>${team.name}</span>
            <span style="font-size: 1.2rem; color: var(--text-secondary);">⋮⋮</span>
        </div>
    `;
}

// 5. Save the UI state to the Database
window.savePoolAssignments = async function() {
    const saveBtn = document.getElementById('savePoolsBtn'); // Adjust ID if yours is different
    if (saveBtn) saveBtn.textContent = 'Saving...';

    const updates = [];
    const lists = document.querySelectorAll('.sortable-team-list');

    lists.forEach(list => {
        const poolId = list.getAttribute('data-pool-id');
        
        // If it is the unassigned bucket, we remove the pool and set seed to 99
        const isUnassigned = (poolId === 'unassigned' || poolId === 'null');
        const finalPoolId = isUnassigned ? null : poolId;

        // Get all the team badges in this specific bucket
        // Note: Make sure your createTeamBadge() function applies 'data-team-id="${t.id}"' to the badge!
        const teamElements = list.querySelectorAll('[data-team-id]'); 

        teamElements.forEach((teamEl, index) => {
            const teamId = teamEl.getAttribute('data-team-id');
            
            updates.push({
                id: teamId,
                pool_id: finalPoolId,
                seed: isUnassigned ? 99 : (index + 1) // 1st item is index 0, so we add 1
            });
        });
    });

    try {
        // Send the bulk update with the new seeds attached
        await adminBulkUpdateTeamPools(updates);
        
        if (saveBtn) saveBtn.textContent = 'Saved!';
        setTimeout(() => { if (saveBtn) saveBtn.textContent = 'Save Pool Assignments'; }, 2000);
        
        // Refresh the grid to ensure everything is synced
        renderPoolAssignmentGrid();
    } catch (error) {
        console.error("Failed to save pool assignments:", error);
        alert("There was an error saving your assignments.");
        if (saveBtn) saveBtn.textContent = 'Save Pool Assignments';
    }
};

// --- LOGO COLOR PICKER LOGIC ---
window.handleLogoPreview = function(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('logoPreviewContainer');
    const canvas = document.getElementById('logoColorCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!file) {
        previewContainer.style.display = 'none';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Set canvas dimensions to match the actual image resolution
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw the image onto the canvas
            ctx.drawImage(img, 0, 0);
            
            // Reveal the preview box!
            previewContainer.style.display = 'flex';
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
};

window.pickColorFromLogo = function(event) {
    const canvas = document.getElementById('logoColorCanvas');
    const ctx = canvas.getContext('2d');
    const colorInput = document.getElementById('newTeamColor');
    
    // Get the exact click coordinates relative to the canvas on the screen
    const rect = canvas.getBoundingClientRect();
    
    // Because CSS shrinks the canvas to max-width: 150px, we have to scale the coordinates
    // to match the original image resolution drawn underneath!
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Grab the specific pixel data (RGBA array)
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    
    // Convert RGB to a HEX code
    const r = pixel[0].toString(16).padStart(2, '0');
    const g = pixel[1].toString(16).padStart(2, '0');
    const b = pixel[2].toString(16).padStart(2, '0');
    const hex = `#${r}${g}${b}`;
    
    // Instantly update the color picker block!
    colorInput.value = hex;
};

window.generateAutoSchedule = function() {
    const grid = document.getElementById('adminMatchGrid');
    const startTimeInput = document.getElementById('scheduleStartTime').value; // e.g., "08:00"
    const increment = parseInt(document.getElementById('scheduleIncrement').value, 10);
    
    if (!globalStandings) {
        alert("No standings data available to generate matches.");
        return;
    }

    // USAV Standard 4-Team Pool Format: [Team A Seed, Team B Seed, Ref Seed]
    const format4Team = [
        [1, 3, 2], // Match 1
        [2, 4, 1], // Match 2
        [1, 4, 3], // Match 3
        [2, 3, 1], // Match 4
        [3, 4, 2], // Match 5
        [1, 2, 4]  // Match 6
    ];

    let html = '';

    Object.keys(globalStandings).forEach(poolId => {
        const pool = globalStandings[poolId];
        // Ensure teams are sorted 1-4
        const teams = [...pool.teams].sort((a, b) => a.seed - b.seed);
        
        // Skip empty or unassigned pools
        if (poolId === 'null' || poolId === 'unassigned' || teams.length < 4) return;

        html += `
        <div class="data-card" style="margin-bottom: 20px;" data-pool-id="${poolId}">
            <div class="card-header" style="background: var(--surface-light);">
                <h3>${pool.name} Schedule</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="text-align: left; font-size: 0.8rem; color: var(--text-secondary);">
                        <th style="padding: 5px;">Time</th>
                        <th style="padding: 5px;">Team A</th>
                        <th style="padding: 5px;">Team B</th>
                        <th style="padding: 5px;">Ref</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Generate the 6 standard matches
        for (let i = 0; i < 6; i++) {
            const matchup = format4Team[i];
            // Subtract 1 because array index starts at 0, but seeds are 1, 2, 3, 4
            const teamA = teams[matchup[0] - 1]; 
            const teamB = teams[matchup[1] - 1];
            const refTeam = teams[matchup[2] - 1];

            // Calculate the time for this specific match
            const matchTime = calculateMatchTime(startTimeInput, increment * i);

            // Generate dropdown options for this pool
            const teamOptions = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

            html += `
                <tr class="match-row">
                    <td style="padding: 5px;">
                        <input type="time" class="match-time" value="${matchTime}" style="padding: 5px; width: 100px;">
                    </td>
                    <td style="padding: 5px;">
                        <select class="match-team-a" style="padding: 5px; width: 100%;">
                            <option value="${teamA.id}" selected>${teamA.name}</option>
                            ${teamOptions.replace(`value="${teamA.id}"`, `value="${teamA.id}" disabled`)}
                        </select>
                    </td>
                    <td style="padding: 5px;">
                        <select class="match-team-b" style="padding: 5px; width: 100%;">
                            <option value="${teamB.id}" selected>${teamB.name}</option>
                            ${teamOptions.replace(`value="${teamB.id}"`, `value="${teamB.id}" disabled`)}
                        </select>
                    </td>
                    <td style="padding: 5px;">
                        <select class="match-ref" style="padding: 5px; width: 100%;">
                            <option value="${refTeam.id}" selected>${refTeam.name}</option>
                            ${teamOptions.replace(`value="${refTeam.id}"`, `value="${refTeam.id}" disabled`)}
                        </select>
                    </td>
                </tr>
            `;
        }

        html += `</tbody></table></div>`;
    });

    grid.innerHTML = html;
};

// Helper function to add minutes to a time string (e.g., "08:00" + 60 mins = "09:00")
function calculateMatchTime(startTime, minutesToAdd) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    date.setMinutes(date.getMinutes() + minutesToAdd);
    return date.toTimeString().substring(0, 5);
}

window.saveAdminMatches = async function() {
    const saveBtn = document.getElementById('saveMatchesBtn');
    if (saveBtn) saveBtn.textContent = 'Saving...';

    let tourneyId = null;

    // 1. Pull the tournament UUID directly from the teams loaded in globalStandings
    if (typeof globalStandings !== 'undefined' && globalStandings) {
        for (const poolId in globalStandings) {
            const pool = globalStandings[poolId];
            if (pool.teams && pool.teams.length > 0 && pool.teams[0].tournament_id) {
                tourneyId = pool.teams[0].tournament_id;
                break;
            }
        }
    }

    // Fallback: check global window objects if globalStandings didn't return one
    if (!tourneyId) {
        tourneyId = window.currentTournamentId 
            || window.currentTournament?.id 
            || window.currentTournamentData?.id;
    }

    if (!tourneyId) {
        alert("Error: Active Tournament UUID could not be found.");
        if (saveBtn) saveBtn.textContent = '💾 Save Matches to Database';
        return;
    }

    const matchesToSave = [];
    const poolCards = document.querySelectorAll('#adminMatchGrid .data-card');

    poolCards.forEach(card => {
        const poolId = card.getAttribute('data-pool-id');
        const rows = card.querySelectorAll('.match-row');
        
        rows.forEach(row => {
            const timeVal = row.querySelector('.match-time')?.value || '';
            const teamAVal = row.querySelector('.match-team-a')?.value || '';
            const teamBVal = row.querySelector('.match-team-b')?.value || '';
            const refVal = row.querySelector('.match-ref')?.value || '';

            if (teamAVal && teamBVal) {
                matchesToSave.push({
                    id: crypto.randomUUID(),
                    tournament_id: tourneyId,
                    pool_id: poolId,
                    time: timeVal,
                    teamA: teamAVal,
                    teamB: teamBVal,
                    ref: refVal,
                    type: 'Pool Play',
                    status: 'Pending'
                });
            }
        });
    });

    if (matchesToSave.length === 0) {
        alert("No valid matches to save.");
        if (saveBtn) saveBtn.textContent = '💾 Save Matches to Database';
        return;
    }

    try {
        const success = await adminBulkInsertMatches(matchesToSave);
        if (success) {
            if (saveBtn) saveBtn.textContent = 'Saved!';
            setTimeout(() => { if (saveBtn) saveBtn.textContent = '💾 Save Matches to Database'; }, 2000);
            if (typeof silentRefresh === 'function') silentRefresh();
        } else {
            throw new Error("Insert rejected by Supabase");
        }
    } catch (error) {
        console.error("Failed to save matches:", error);
        alert("There was an error saving the schedule. Check the browser console for details.");
        if (saveBtn) saveBtn.textContent = '💾 Save Matches to Database';
    }
};

window.populateEditInfoForm = function(tournamentData) {
    if (!tournamentData) return;
    
    // Replace these IDs with the actual IDs of your inputs in index.html
    const nameInput = document.getElementById('editTourneyName');
    const locationInput = document.getElementById('editTourneyLocation');
    const dateInput = document.getElementById('editTourneyDate');
    
    if (nameInput) nameInput.value = tournamentData.name || '';
    if (locationInput) locationInput.value = tournamentData.location || '';
    if (dateInput) dateInput.value = tournamentData.date || '';
};