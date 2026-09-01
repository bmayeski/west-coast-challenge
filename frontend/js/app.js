// app.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, setTournamentId, setTournamentData, setCurrentView } from './state.js';
import { initAuth } from './adminAuth.js';
import { initPools, loadTeams } from './adminPools.js';
import { initSchedule, loadSchedule } from './adminSchedule.js';
import { initEditor, loadTournamentInfo } from './adminInfo.js';
import { initScores } from './adminScores.js';
import { populateTeamDropdown, renderMyTeam } from './uiTeam.js';
import { renderPublicInfo, renderPublicPools } from './uiPublic.js';
import { initManagePools, loadPoolScores } from './adminManagePools.js';
import { renderBracketView, initBracketAdmin } from './uiBracket.js';

// --- VIEW NAVIGATION (ROUTER) ---
export function switchView(viewId) {
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none'; 
    });
  
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
  
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block'; 
    }

    const targetBtn = document.getElementById('btn-' + viewId);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    setCurrentView(viewId);

    if (viewId === 'bracketsView') {
        renderBracketView();
    }
}

// --- ADMIN SUB-VIEW NAVIGATION ---
export function switchAdminView(subViewId) {
    const subViews = document.querySelectorAll('.admin-sub-view');
    subViews.forEach(v => v.style.display = 'none');
    
    const adminNavBtns = document.querySelectorAll('#adminView .nav-btn:not(#btn-adminLogout)');
    adminNavBtns.forEach(btn => btn.classList.remove('active'));
    
    const target = document.getElementById(subViewId);
    if (target) target.style.display = 'block';
    
    const targetBtn = document.getElementById('btn-' + subViewId);
    if (targetBtn) targetBtn.classList.add('active');
}

// --- LOAD TOURNAMENT DIRECTORY (LANDING PAGE) ---
export async function loadTournamentDirectory() {
    const container = document.getElementById('tournamentDirectory');
    if (!container) return;

    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .in('status', ['published', 'active', 'completed']);

        if (error) throw error;

        if (!tournaments || tournaments.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No active tournaments scheduled yet.</p>';
            return;
        }

        container.innerHTML = '';
        tournaments.forEach(t => {
            const card = document.createElement('a');
            card.href = `?t=${encodeURIComponent(t.slug)}`; 
            card.className = 'tournament-card';
            card.style.cssText = 'display: block; background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; text-decoration: none; color: inherit; min-width: 250px;';
            
            let displayStatus = t.status === 'published' ? 'Upcoming' : t.status;
            displayStatus = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; background: ${t.status === 'active' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)'}; color: white; font-weight: bold;">${displayStatus}</span>
                </div>
                <h4 style="margin: 0 0 10px 0; color: var(--text-primary); font-size: 1.1rem;">${t.name}</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">📅 ${t.date || 'TBD'}</p>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">📍 ${t.location || 'TBD'}</p>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading tournament directory:', err);
        container.innerHTML = '<p style="color: var(--text-secondary);">Unable to load live events at this time.</p>';
    }
}

// --- ATTACH TO WINDOW FOR HTML ONCLICK ALERTS ---
window.switchView = switchView;
window.renderMyTeam = renderMyTeam;

window.attemptAdminLogin = () => {
    document.getElementById('adminLoginModal').style.display = 'flex';
};
document.getElementById('closeAdminLoginBtn')?.addEventListener('click', () => {
    document.getElementById('adminLoginModal').style.display = 'none';
});

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentSlug = urlParams.get('t');

    if (tournamentSlug) {
        document.getElementById('mainNav').style.display = 'flex';

        // THE FIX: Changed to select('*') to grab all configuration columns
        const { data, error } = await supabase
            .from('tournaments')
            .select('*') 
            .eq('slug', tournamentSlug)
            .single();

        if (data && !error) {
            setTournamentId(data.id);
            setTournamentData(data); 
            
            document.getElementById('app-header-title').innerText = data.name;
            if (data.theme_color) {
                document.documentElement.style.setProperty('--accent-orange', data.theme_color);
            }
            
            console.log("App Initialized. Active Tournament ID:", data.id);
        } else {
            console.error("Could not locate tournament by slug.");
        }
    }

    // Wire up Admin Sub-navigation buttons
    document.getElementById('btn-adminInfo')?.addEventListener('click', () => switchAdminView('adminInfo'));
    document.getElementById('btn-adminSetup')?.addEventListener('click', () => switchAdminView('adminSetup'));
    document.getElementById('btn-adminSchedule')?.addEventListener('click', () => switchAdminView('adminSchedule'));
    document.getElementById('btn-adminStandings')?.addEventListener('click', () => {
        switchAdminView('adminStandings');
        loadPoolScores(); 
    });
    document.getElementById('btn-adminBrackets')?.addEventListener('click', () => switchAdminView('adminBrackets'));
    
    // NEW: Wire up the Bracket Scores button WITH A DELAY to fix the canvas rendering bug
    document.getElementById('btn-adminBracketScores')?.addEventListener('click', () => {
        switchAdminView('adminBracketScores');
        
        // This tiny 10ms delay gives the browser time to paint the new tab 
        // before we try to mathematically calculate and draw the brackets.
        setTimeout(() => {
            if (typeof renderBracketView === 'function') {
                renderBracketView();
            }
        }, 10);
    });
    
    initAuth();
    initPools();
    initSchedule();
    initEditor();
    initScores();
    initManagePools();
    initBracketAdmin();
    
    if (getTournamentId()) {
        switchView('infoView'); 
        await Promise.all([
            loadTeams(),
            loadSchedule(),
            loadTournamentInfo()
        ]);
        populateTeamDropdown();
        
        renderPublicInfo();
        renderPublicPools();
    } else if (!tournamentSlug) {
        loadTournamentDirectory();
    }
});