import { verifySuperAdminPassword, adminCreateTournament, fetchAllTournaments } from './api.js';
import { switchView, loadTournamentDirectory } from './app.js';

export async function attemptSuperAdminLogin() {
    const password = prompt("Enter Super Admin Password:");
    if (password === null) return; 

    const isValid = await verifySuperAdminPassword(password);

    if (isValid) { 
        // Hide all views and show masterAdminView
        document.querySelectorAll('.view-section').forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });
        
        const masterView = document.getElementById('masterAdminView');
        if (masterView) {
            masterView.style.display = 'block';
            masterView.classList.add('active');
        }
        
        // Render the management list
        renderSuperAdminTournamentList();
    } else {
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

    const id = idInput.value.trim().toLowerCase().replace(/\s+/g, '-'); 
    const name = nameInput.value.trim();

    if (!id || !name) {
        alert("Tournament ID and Name are required!");
        return;
    }

    const success = await adminCreateTournament(
        id, 
        name, 
        dateInput.value.trim(), 
        locInput.value.trim(), 
        statusInput.value,
        colorInput.value 
    );

    if (success) {
        alert(`Tournament "${name}" created successfully!`);
        idInput.value = ''; nameInput.value = ''; dateInput.value = ''; locInput.value = '';
        if (colorInput) colorInput.value = '#F26922'; 
        
        renderSuperAdminTournamentList();
        loadTournamentDirectory();
    } else {
        alert("Failed to create tournament. Ensure the ID is unique.");
    }
}

export async function renderSuperAdminTournamentList() {
    const list = document.getElementById('superAdminTournamentList');
    if (!list) return;

    list.innerHTML = '<p style="color: var(--text-secondary);">Loading...</p>';
    const tournaments = await fetchAllTournaments();
    
    list.innerHTML = '';
    tournaments.forEach(t => {
        list.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px;">
                <div>
                    <strong style="color: var(--text-primary); display: block;">${t.name}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">URL: ?t=${t.slug} | ${t.status}</span>
                </div>
                <a href="?t=${t.slug}" class="admin-btn" style="text-decoration: none; font-size: 0.8rem;">Enter</a>
            </div>
        `;
    });
}

// Attach to window so your HTML buttons can click them
window.attemptSuperAdminLogin = attemptSuperAdminLogin;
window.logoutSuperAdmin = logoutSuperAdmin;
window.superAdminCreateTournament = superAdminCreateTournament;