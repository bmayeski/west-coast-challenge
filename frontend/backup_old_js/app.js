// app.js
import { supabase } from './supabaseClient.js';
import { 
    setTournamentId, 
    getTournamentId, 
    setAdminAuth, 
    isAdmin 
} from './state.js';

// Example: Testing the connection and state
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App Initialized. Current Tournament ID:", getTournamentId());
    
    // Test Supabase connection
    const { data, error } = await supabase.from('tournaments').select('*').limit(1);
    
    if (error) {
        console.error("Supabase Error:", error.message);
    } else {
        console.log("Connected to Supabase! Tournaments found:", data);
    }
});

// --- 1. IMPORTS ---
import { fetchDatabase, submitScoreUpdate, fetchAllTournaments, getTournamentInfo } from './api.js';
import { openScoreModal, closeScoreModal } from './uiModal.js';
import { initBracketPanZoom, renderBracket } from './uiBracket.js';
import { populateTeamDropdown, renderMyTeam } from './uiTeam.js';
import { getStandingsData, getBracketData } from './uiMath.js';
import { renderPools } from './uiPools.js';
import { attemptAdminLogin, closeAdminLogin, submitAdminLogin, logoutAdmin, switchAdminSubView, adminAddPool, adminAddTeam } from './uiAdmin.js';

// --- 2. GLOBAL STATE ---
export let globalStandings = null;
export let globalBracketsGold = null;
export let globalBracketsSilver = null;
export let currentTournamentId = null;

// --- 3. VIEW NAVIGATION ---
export function switchView(viewId) {
  // 1. Hide all views by resetting classes AND inline styles
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none'; 
  });
  
  // 2. Remove the active highlight from ALL navigation buttons
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => btn.classList.remove('active'));
  
  // 3. Show the target view and force the display style
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
    
    // Brackets need flexbox, everything else uses block
    if (viewId === 'bracketsView') {
      targetView.style.display = 'flex';
      targetView.style.flexDirection = 'column'; 
    } else {
      targetView.style.display = 'block'; 
    }
  }

  // 4. Add the active highlight to the button you just clicked
  const targetBtn = document.getElementById('btn-' + viewId);
  if (targetBtn) {
    targetBtn.classList.add('active');
  }

  // 5. Fetch fresh data from Supabase if we aren't reading the Info or Landing tabs
  if (viewId !== 'infoView' && viewId !== 'landingView') {
    silentRefresh();
  }
}

// --- 4. EXPOSE TO HTML ---
window.switchView = switchView;
window.openScoreModal = openScoreModal;
window.closeScoreModal = closeScoreModal;
window.submitScoreUpdate = () => submitScoreUpdate(silentRefresh); 
window.loadPoolData = () => silentRefresh();
window.loadBracketData = () => silentRefresh();
window.renderMyTeam = () => renderMyTeam();
window.attemptAdminLogin = attemptAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.submitAdminLogin = submitAdminLogin;
window.logoutAdmin = logoutAdmin;
window.switchAdminSubView = switchAdminSubView;
window.adminAddPool = adminAddPool;
window.adminAddTeam = adminAddTeam;

// --- 5. TOURNAMENT DIRECTORY (LANDING VIEW) ---
export async function loadTournamentDirectory() {
  const container = document.getElementById('tournamentDirectory');
  if (!container) return;

  container.innerHTML = '<p style="color: var(--text-secondary);">Loading live events...</p>';

  try {
    const allTournaments = await fetchAllTournaments();

    // FILTER: Only show Published, Active, or Completed to the public!
    const publicTournaments = allTournaments.filter(t => 
        t.status === 'published' || t.status === 'active' || t.status === 'completed'
    );

    if (!publicTournaments || publicTournaments.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No active tournaments scheduled yet.</p>';
      return;
    }

    container.innerHTML = '';
    publicTournaments.forEach(t => {
      const card = document.createElement('a');
      card.href = `?t=${encodeURIComponent(t.slug)}`; 
      card.className = 'tournament-card';
      
      let displayStatus = t.status === 'published' ? 'Upcoming' : t.status;
      displayStatus = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

      card.innerHTML = `
        <div class="tournament-card-header">
          <span class="status-badge ${t.status === 'active' ? 'active' : ''}">${displayStatus}</span>
          <h4>${t.name}</h4>
        </div>
        <p class="tournament-card-detail">📅 ${t.date || 'TBD'}</p>
        <p class="tournament-card-detail">📍 ${t.location || 'TBD'}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading tournament directory:', err);
    container.innerHTML = '<p style="color: var(--text-secondary);">Unable to load live events at this time.</p>';
  }
}

// --- 6. SILENT POLLER & UI REFRESH ---
export async function silentRefresh() {
    if (!currentTournamentId) return; 

    const db = await fetchDatabase(currentTournamentId);

    // A. Always calculate Standings
    if (typeof getStandingsData === 'function') {
        globalStandings = getStandingsData(db.pools, db.teams, db.matches);
    }
  
  // B. Always calculate Brackets in the background so My Team can read them!
  if (typeof getBracketData === 'function') {
      globalBracketsGold = getBracketData("Gold", globalStandings, db.matches);
      globalBracketsSilver = getBracketData("Silver", globalStandings, db.matches);
  }

  const poolsView = document.getElementById('poolsView');
  const teamView = document.getElementById('teamView');
  const bracketsView = document.getElementById('bracketsView');

  // Pools View
  if (poolsView && poolsView.classList.contains('active') && typeof renderPools === 'function') {
    renderPools(globalStandings);
  } 
  
  // Team View
  else if (teamView && teamView.classList.contains('active')) {
    populateTeamDropdown();
    renderMyTeam();
  }

  // Brackets View
  if (bracketsView && bracketsView.classList.contains('active')) {
    const filter = document.getElementById('publicBracketFilter');
    const activeDivision = filter ? filter.value : "Gold";
    
    const bracketData = activeDivision === "Gold" ? globalBracketsGold : globalBracketsSilver;
    
    if (typeof renderBracket === 'function') {
      renderBracket(bracketData);
    }
  }
}

// --- 7. ROUTER & APP INITIALIZATION ---
export function initializeApp() {
  const urlParams = new URLSearchParams(window.location.search);
  currentTournamentId = urlParams.get('t');

  const mainNav = document.getElementById('mainNav');
  const appHeaderTitle = document.getElementById('app-header-title');

  if (currentTournamentId) {
    // --- TOURNAMENT MODE ---
    if (mainNav) mainNav.style.display = 'flex';
    if (appHeaderTitle) {
      appHeaderTitle.innerHTML = `<a href="/" style="color: inherit; text-decoration: none;">Loading Event...</a>`;
    }

    renderPublicInfo();

    switchView('infoView');
    silentRefresh();
  } else {
    // --- LANDING PAGE MODE ---
    if (mainNav) mainNav.style.display = 'none';
    if (appHeaderTitle) appHeaderTitle.innerText = 'Sports Ski-Matics';

    switchView('landingView');
    loadTournamentDirectory();
  }

  initBracketPanZoom();
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  setInterval(silentRefresh, 60000);
});

// --- 8. RENDER PUBLIC INFO PAGE ---
export async function renderPublicInfo() {
    const container = document.getElementById('dynamicInfoContainer');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--text-secondary);">Loading tournament information...</p>';

    const tournamentData = await getTournamentInfo();

    // 1. SET THEME COLOR & HEADER TITLE IMMEDIATELY
    if (tournamentData) {
        const activeThemeColor = tournamentData.theme_color || '#F26922'; 
        document.documentElement.style.setProperty('--accent-orange', activeThemeColor);

        const appHeaderTitle = document.getElementById('app-header-title');
        if (appHeaderTitle && tournamentData.name) {
             appHeaderTitle.innerHTML = `<a href="/" style="color: inherit; text-decoration: none;">${tournamentData.name}</a>`;
        }
    }

    // 2. CHECK FOR INFO CONTENT
    if (!tournamentData || !tournamentData.info_data || tournamentData.info_data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No information has been posted yet.</p>';
        return;
    }

    container.innerHTML = '';
    let currentCardContentBox = null;
    const infoData = tournamentData.info_data;

    infoData.forEach(section => {
        const card = document.createElement('div');
        
        // 1. FLOATING TEXT CHECK
        if (!section.title && !section.icon && !section.isSubBox) {
            card.style.cssText = 'margin-bottom: 20px; text-align: center;';
            card.innerHTML = `<div class="info-content-box" style="color: var(--accent-orange); font-size: 1.1rem; font-weight: bold; padding: 10px;">${section.content}</div>`;
            container.appendChild(card);
            return; 
        }

        // 2. THE NEW SUB-BOX CHECK!
        if (section.isSubBox && currentCardContentBox) {
            const subBox = document.createElement('div');
            subBox.style.cssText = 'background-color: rgba(0, 0, 0, 0.2); border-left: 4px solid var(--accent-orange); padding: 12px 15px; margin-top: 15px; border-radius: 0 4px 4px 0;';
            subBox.innerHTML = section.content; 
            currentCardContentBox.appendChild(subBox);
            return; 
        }

        // 3. STANDARD CARD CREATION
        card.style.cssText = 'background: var(--surface-dark); border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color); border-top: 4px solid var(--accent-orange); overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
        
        const isDirector = section.title.toLowerCase().includes('director');
        const headerJustify = isDirector ? 'center' : 'flex-start';

        card.innerHTML = `
            <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: ${headerJustify}; gap: 8px;">
                <span style="font-size: 1.1rem;">${section.icon}</span>
                <h3 style="color: var(--text-primary); margin: 0; font-size: 1.05rem; font-weight: bold;">${section.title}</h3>
            </div>
            
            <div class="info-content-box" style="padding: 10px 12px; color: var(--text-secondary); line-height: 1.4; font-size: 0.9rem;">
                ${section.content}
            </div>
        `;
        
        currentCardContentBox = card.querySelector('.info-content-box');
        container.appendChild(card);
    });
}