// --- 1. IMPORTS ---
import { fetchDatabase, submitScoreUpdate } from './api.js';
import { openScoreModal, closeScoreModal } from './uiModal.js';
import { initBracketPanZoom, renderBracket } from './uiBracket.js';
import { populateTeamDropdown, renderMyTeam } from './uiTeam.js';
import { getStandingsData, getBracketData } from './uiMath.js';
import { renderPools } from './uiPools.js';

// --- 2. GLOBAL STATE ---
export let globalStandings = null;
export let globalBracketsGold = null;
export let globalBracketsSilver = null;

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

  // 5. Fetch fresh data from Supabase if we aren't just reading the Info tab
  if (viewId !== 'infoView') {
    silentRefresh();
  }
}

// --- 4. EXPOSE TO HTML (Fixes all undefined errors) ---
window.switchView = switchView;
window.openScoreModal = openScoreModal;
window.closeScoreModal = closeScoreModal;
window.submitScoreUpdate = () => submitScoreUpdate(silentRefresh); 
window.loadPoolData = () => silentRefresh();
window.loadBracketData = () => silentRefresh();
window.renderMyTeam = () => renderMyTeam();

// --- 5. SILENT POLLER & UI REFRESH ---
export async function silentRefresh() {
  const db = await fetchDatabase();
  
  if (typeof getStandingsData === 'function') {
    globalStandings = getStandingsData(db.pools, db.teams, db.matches);
  }
  
  const poolsView = document.getElementById('poolsView');
  const teamView = document.getElementById('teamView');
  const bracketsView = document.getElementById('bracketsView');

  // Pools
  if (poolsView && poolsView.classList.contains('active') && typeof renderPools === 'function') {
    renderPools(globalStandings);
  } 
  
  // Team View
  else if (teamView && teamView.classList.contains('active')) {
    populateTeamDropdown();
    renderMyTeam();
  }

  // Brackets
  const filter = document.getElementById('publicBracketFilter');
  const activeDivision = filter ? filter.value : "Gold";

  if (bracketsView && bracketsView.classList.contains('active')) {
    if (typeof getBracketData === 'function') {
      const bracketData = getBracketData(activeDivision, globalStandings, db.matches);
      if (activeDivision === "Gold") globalBracketsGold = bracketData;
      if (activeDivision === "Silver") globalBracketsSilver = bracketData;
      
      if (typeof renderBracket === 'function') {
        renderBracket(bracketData);
      }
    }
  }
}

// --- 6. INITIALIZE APP ---
document.addEventListener("DOMContentLoaded", () => {
  switchView('infoView');
  initBracketPanZoom();
  setInterval(silentRefresh, 60000);
});