import { verifyAdminPassword, adminInsertPool, adminUploadLogo, adminInsertTeam } from './api.js';
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
    window.switchView('infoView'); 
}

export function switchAdminSubView(subViewId) {
    const views = document.querySelectorAll('.admin-sub-view');
    views.forEach(v => v.style.display = 'none');
    
    const buttons = document.querySelectorAll('#adminView .nav-btn');
    buttons.forEach(b => b.classList.remove('active'));

    const targetView = document.getElementById(subViewId);
    if (targetView) targetView.style.display = 'block';

    const targetBtn = document.getElementById('btn-' + subViewId);
    if (targetBtn) targetBtn.classList.add('active');
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
        // TODO: Refresh the drag-and-drop grid here later
    } else {
        alert("Failed to add team. Check the console for details.");
    }

    btn.disabled = false;
    btn.textContent = '+ Add Team';
}