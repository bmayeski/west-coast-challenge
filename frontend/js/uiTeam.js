import { lightenColor, formatTime } from './utils.js';
import { globalStandings, globalBracketsGold, globalBracketsSilver } from './app.js';

export function populateTeamDropdown() {
    const select = document.getElementById('myTeamSelect');
    if (!select || !globalStandings) return;
    
    const currentSelection = select.value;
    select.innerHTML = '<option value="">-- Select a Team --</option>';
    
    let allTeams = [];
    Object.keys(globalStandings).forEach(poolKey => {
        globalStandings[poolKey].teams.forEach(t => allTeams.push(t));
    });
    
    allTeams.sort((a,b) => a.name.localeCompare(b.name)); 
    
    allTeams.forEach(t => {
        let isSelected = (t.name === currentSelection) ? 'selected' : '';
        select.innerHTML += `<option value="${t.name}" ${isSelected}>${t.name}</option>`;
    });
}

export function renderMyTeam() {
    const select = document.getElementById('myTeamSelect');
    const teamName = select ? select.value : null;
    const content = document.getElementById('myTeamContent');
    
    if (!teamName) { 
       if (content) content.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 40px;">Select a team from the dropdown above to view their dashboard.</p>'; 
       return; 
    }

    let myTeam = null;
    let myPool = null;

    Object.keys(globalStandings).forEach(poolKey => {
        let found = globalStandings[poolKey].teams.find(t => t.name === teamName);
        if (found) { myTeam = found; myPool = globalStandings[poolKey]; }
    });

    if (!myTeam) return;

    let displayColor = lightenColor(myTeam.color, 0.4); 
    const logoHTML = myTeam.logoId ? `<img src="https://lh3.googleusercontent.com/d/${myTeam.logoId}" style="width: 50px; height: 50px; object-fit: contain;">` : '';

    let html = `
      <div class="data-card" style="text-align: center; padding: 20px; border-top: 4px solid ${displayColor}; margin-bottom: 25px;">
         ${logoHTML}
         <h2 style="margin: 10px 0 5px 0; color: ${displayColor};">${myTeam.name}</h2>
         <div style="color: var(--text-secondary); font-size: 0.9rem;">🏐 ${myPool.name} | ${myPool.site}</div>
         <div style="display: flex; justify-content: center; gap: 20px; margin-top: 15px;">
            <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--text-primary);">${myTeam.wins} - ${myTeam.losses}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Matches</div></div>
            <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--text-primary);">${myTeam.setsWon} - ${myTeam.setsLost}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">Sets</div></div>
         </div>
      </div>
    `;

    // 1. POOL SCHEDULE
    let myMatches = myPool.matches.filter(m => m.teamA === myTeam.name || m.teamB === myTeam.name || m.ref === myTeam.name);
    
    html += `<h3 style="font-size: 1.1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-top: 25px;">Pool Schedule & Duties</h3>`;
    
    if (myMatches.length === 0) {
        html += `<p style="color: var(--text-secondary);">No pool matches scheduled yet.</p>`;
    } else {
        html += `<div class="matches-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 15px;">`;
        myMatches.forEach(match => {
            let isReffing = match.ref === myTeam.name;
            let isComplete = match.status === 'Complete' || match.status === 'Final';
            let opacity = isComplete ? '1' : '0.6';
            let borderHighlight = isComplete ? `border-left: 4px solid var(--accent-orange);` : `border-left: 4px solid var(--border-color);`;
            
            let refBadge = isReffing ? `<span style="font-size: 0.65rem; background: var(--accent-orange); color: #FFF; padding: 2px 6px; border-radius: 4px; font-weight: bold;">REF DUTY</span>` : '';
            let refText = isReffing ? `<span style="color: var(--accent-orange); font-weight: bold;">Ref: ${match.ref}</span>` : `Ref: ${match.ref || '-'}`;

            html += `
              <div class="data-card" style="padding: 12px; opacity: ${opacity}; ${borderHighlight} margin: 0; background: var(--surface-dark); border-radius: 6px;">
                 <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                     <div style="display: flex; flex-direction: column; gap: 5px;">
                         <span style="font-size: 0.7rem; background: var(--surface-lighter); padding: 3px 6px; border-radius: 4px; color: var(--text-secondary); width: fit-content;">${match.status || 'Pending'}</span>
                         ${refBadge}
                     </div>
                     <div style="display: flex; flex-direction: column; gap: 5px; text-align: right;">
                         <span style="font-size: 0.8rem; color: var(--accent-orange); font-weight: bold;">🕒 ${formatTime(match.time)}</span>
                         <span style="font-size: 0.75rem; color: var(--text-secondary);">${refText}</span>
                     </div>
                 </div>
                 <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center;">
                    <tr>
                       <td style="text-align: left; color: ${match.teamA === myTeam.name ? displayColor : 'var(--text-primary)'}; padding: 4px 0; font-weight: 600;">${match.teamA}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s1A || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s2A || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s3A || '-'}</td>
                    </tr>
                    <tr>
                       <td style="text-align: left; color: ${match.teamB === myTeam.name ? displayColor : 'var(--text-primary)'}; padding: 4px 0; font-weight: 600;">${match.teamB}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s1B || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s2B || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s3B || '-'}</td>
                    </tr>
                 </table>
              </div>
            `;
        });
        html += `</div>`;
    }

    // 2. BRACKET SCHEDULE (ADDED)
    let bracketMatches = [];
    [...(globalBracketsGold?.matches || []), ...(globalBracketsSilver?.matches || [])].forEach(m => {
        if (m && (m.teamA === myTeam.name || m.teamB === myTeam.name || m.ref === myTeam.name)) {
            bracketMatches.push(m);
        }
    });

    if (bracketMatches.length > 0) {
        html += `<h3 style="font-size: 1.1rem; color: var(--text-primary); margin-top: 25px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Bracket Matches</h3>`;
        html += `<div class="matches-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 15px;">`;
        
        bracketMatches.forEach(match => {
            let isReffing = match.ref === myTeam.name;
            let isComplete = match.status === 'Complete' || match.status === 'Final';
            let opacity = isComplete ? '1' : '0.6';
            let borderHighlight = isComplete ? `border-left: 4px solid var(--accent-orange);` : `border-left: 4px solid var(--border-color);`;
            
            let refBadge = isReffing ? `<span style="font-size: 0.65rem; background: var(--accent-orange); color: #FFF; padding: 2px 6px; border-radius: 4px; font-weight: bold;">REF DUTY</span>` : '';
            let refText = isReffing ? `<span style="color: var(--accent-orange); font-weight: bold;">Ref: ${match.ref}</span>` : `Ref: ${match.ref || '-'}`;

            html += `
              <div class="data-card" style="padding: 12px; opacity: ${opacity}; ${borderHighlight} margin: 0; background: var(--surface-dark); border-radius: 6px;">
                 <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                     <div style="display: flex; flex-direction: column; gap: 5px;">
                         <div style="display: flex; gap: 8px; align-items: center;">
                             <span style="font-size: 0.7rem; background: var(--surface-lighter); padding: 3px 6px; border-radius: 4px; color: var(--text-secondary); width: fit-content;">${match.status || 'Pending'}</span>
                             <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: bold;">Match ${match.id}</span>
                         </div>
                         ${refBadge}
                     </div>
                     <div style="display: flex; flex-direction: column; gap: 5px; text-align: right;">
                         <span style="font-size: 0.8rem; color: var(--accent-orange); font-weight: bold;">🕒 ${formatTime(match.time)}</span>
                         <span style="font-size: 0.75rem; color: var(--text-secondary);">${refText}</span>
                     </div>
                 </div>
                 <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center;">
                    <tr>
                       <td style="text-align: left; color: ${match.teamA === myTeam.name ? displayColor : 'var(--text-primary)'}; padding: 4px 0; font-weight: 600;">${match.teamA}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s1A || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s2A || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s3A || '-'}</td>
                    </tr>
                    <tr>
                       <td style="text-align: left; color: ${match.teamB === myTeam.name ? displayColor : 'var(--text-primary)'}; padding: 4px 0; font-weight: 600;">${match.teamB}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s1B || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s2B || '-'}</td>
                       <td style="width: 16%; color: var(--text-secondary);">${match.s3B || '-'}</td>
                    </tr>
                 </table>
              </div>
            `;
        });
        html += `</div>`;
    }

    // 3. DISCLAIMER (ADDED)
    html += `<div style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; font-style: italic; margin-top: 20px; padding-bottom: 20px;">* Times are estimates. Matches start when courts clear.</div>`;
    
    if (content) content.innerHTML = html;
}