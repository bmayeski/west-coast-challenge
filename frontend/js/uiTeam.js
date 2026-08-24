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

    let bracketWins = 0; let bracketLosses = 0;
    let bracketSetsWon = 0; let bracketSetsLost = 0;
    let bracketMatches = [];
    let playedBracketMatches = []; // Excludes matches where they only reffed

    [...(globalBracketsGold?.matches || []), ...(globalBracketsSilver?.matches || [])].forEach(m => {
        if (m && (m.teamA === myTeam.name || m.teamB === myTeam.name || m.ref === myTeam.name)) {
            bracketMatches.push(m);
            
            if (m.teamA === myTeam.name || m.teamB === myTeam.name) {
                playedBracketMatches.push(m);
            }
            
            let isComplete = m.status === 'Complete' || m.status === 'Final';
            if (isComplete && (m.teamA === myTeam.name || m.teamB === myTeam.name)) {
                let setsA = 0; let setsB = 0;
                if (m.s1A !== "" && m.s1B !== "") { parseInt(m.s1A) > parseInt(m.s1B) ? setsA++ : setsB++; }
                if (m.s2A !== "" && m.s2B !== "") { parseInt(m.s2A) > parseInt(m.s2B) ? setsA++ : setsB++; }
                if (setsA < 2 && setsB < 2 && m.s3A !== "" && m.s3B !== "") { parseInt(m.s3A) > parseInt(m.s3B) ? setsA++ : setsB++; }
                
                if (m.teamA === myTeam.name) {
                    bracketSetsWon += setsA; bracketSetsLost += setsB;
                    if (setsA > setsB) bracketWins++; else if (setsB > setsA) bracketLosses++;
                } else {
                    bracketSetsWon += setsB; bracketSetsLost += setsA;
                    if (setsB > setsA) bracketWins++; else if (setsA > setsB) bracketLosses++;
                }
            }
        }
    });

    // --- Calculate Pool Placement ---
    let poolFinishText = '';
    if (myTeam.place) {
        let ordinal = myTeam.place === 1 ? 'st' : myTeam.place === 2 ? 'nd' : myTeam.place === 3 ? 'rd' : 'th';
        poolFinishText = `${myTeam.place}${ordinal} Place`;
    }

    // --- Calculate Smart Bracket Placement ---
    let division = "";
    if (globalBracketsGold?.matches?.some(m => m.teamA === myTeam.name || m.teamB === myTeam.name)) division = "Gold";
    else if (globalBracketsSilver?.matches?.some(m => m.teamA === myTeam.name || m.teamB === myTeam.name)) division = "Silver";
    
    let playoffFinishText = division ? `${division} Bracket` : "TBD";
    
    if (division && playedBracketMatches.length > 0) {
        const depthMap = { 'Seeding': 1, 'Quarterfinals': 2, 'Semifinals': 3, 'Finals': 4 };
        let maxDepth = 0;
        let deepestMatch = null;
        
        playedBracketMatches.forEach(m => {
            let depth = depthMap[m.type] || 0;
            if (depth > maxDepth) {
                maxDepth = depth;
                deepestMatch = m;
            }
        });

        if (deepestMatch) {
            let isComplete = deepestMatch.status === 'Complete' || deepestMatch.status === 'Final';
            
            if (!isComplete) {
                playoffFinishText = `In ${division} ${deepestMatch.type}`;
            } else {
                let setsA = 0; let setsB = 0;
                if (deepestMatch.s1A !== "" && deepestMatch.s1B !== "") { parseInt(deepestMatch.s1A) > parseInt(deepestMatch.s1B) ? setsA++ : setsB++; }
                if (deepestMatch.s2A !== "" && deepestMatch.s2B !== "") { parseInt(deepestMatch.s2A) > parseInt(deepestMatch.s2B) ? setsA++ : setsB++; }
                if (setsA < 2 && setsB < 2 && deepestMatch.s3A !== "" && deepestMatch.s3B !== "") { parseInt(deepestMatch.s3A) > parseInt(deepestMatch.s3B) ? setsA++ : setsB++; }

                let wonDeepest = (deepestMatch.teamA === myTeam.name && setsA > setsB) || (deepestMatch.teamB === myTeam.name && setsB > setsA);

                if (deepestMatch.type === 'Finals') {
                    playoffFinishText = wonDeepest ? `🏆 ${division} Champion` : `🥈 ${division} 2nd Place`;
                } else if (deepestMatch.type === 'Semifinals') {
                    playoffFinishText = wonDeepest ? `Adv to ${division} Finals` : `🥉 ${division} Semifinalist (3rd)`;
                } else if (deepestMatch.type === 'Quarterfinals') {
                    playoffFinishText = wonDeepest ? `Adv to ${division} Semis` : `🏅 ${division} Quarterfinalist (5th)`;
                } else {
                    playoffFinishText = `${division} Bracket`;
                }
            }
        }
    }

    let html = `
      <div class="data-card" style="text-align: center; padding: 20px; border-top: 4px solid ${displayColor}; margin-bottom: 25px;">
         ${logoHTML}
         <h2 style="margin: 10px 0 5px 0; color: ${displayColor};">${myTeam.name}</h2>
         <div style="color: var(--text-secondary); font-size: 0.9rem;">🏐 ${myPool.name} | ${myPool.site}</div>
         
         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px;">
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>Pool Play</span>
                    <span style="color: ${displayColor};">${poolFinishText}</span>
                </div>
                <div style="display: flex; justify-content: space-around;">
                   <div><div style="font-size: 1.3rem; font-weight: bold; color: var(--text-primary);">${myTeam.wins}-${myTeam.losses}</div><div style="font-size: 0.7rem; color: var(--text-secondary);">Match</div></div>
                   <div><div style="font-size: 1.3rem; font-weight: bold; color: var(--text-primary);">${myTeam.setsWon}-${myTeam.setsLost}</div><div style="font-size: 0.7rem; color: var(--text-secondary);">Set</div></div>
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>Playoffs</span>
                    <span style="color: ${displayColor};">${playoffFinishText}</span>
                </div>
                <div style="display: flex; justify-content: space-around;">
                   <div><div style="font-size: 1.3rem; font-weight: bold; color: var(--text-primary);">${bracketWins}-${bracketLosses}</div><div style="font-size: 0.7rem; color: var(--text-secondary);">Match</div></div>
                   <div><div style="font-size: 1.3rem; font-weight: bold; color: var(--text-primary);">${bracketSetsWon}-${bracketSetsLost}</div><div style="font-size: 0.7rem; color: var(--text-secondary);">Set</div></div>
                </div>
            </div>
         </div>
      </div>
    `;

    const getContrastYIQ = (hexcolor) => {
        if (!hexcolor || !hexcolor.includes('#')) return '#FFFFFF';
        let hex = hexcolor.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 135) ? '#0F172A' : '#FFFFFF'; 
    };

    const badgeTextColor = getContrastYIQ(displayColor);

    const getSetHighlight = (sA, sB) => {
        let numA = parseInt(sA); let numB = parseInt(sB);
        if (isNaN(numA) || isNaN(numB)) return { a: 'color: var(--text-secondary);', b: 'color: var(--text-secondary);' };
        if (numA > numB) return { a: 'background: rgba(255,255,255,0.15); color: #FFF; font-weight: bold; border-radius: 4px; padding: 2px 8px;', b: 'color: var(--text-secondary);' };
        if (numB > numA) return { a: 'color: var(--text-secondary);', b: 'background: rgba(255,255,255,0.15); color: #FFF; font-weight: bold; border-radius: 4px; padding: 2px 8px;' };
        return { a: 'color: var(--text-secondary);', b: 'color: var(--text-secondary);' };
    };

    const renderMatchCard = (match) => {
        let isReffing = match.ref === myTeam.name;
        let isComplete = match.status === 'Complete' || match.status === 'Final';
        let opacity = isComplete ? '1' : '0.8';
        
        let borderHighlight = isComplete ? `border-left: 4px solid ${displayColor};` : 'border-left: 4px solid var(--border-color);';
        
        let refBadge = isReffing ? `<span style="font-size: 0.65rem; background: ${displayColor}; color: ${badgeTextColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">REF DUTY</span>` : '';
        let refText = isReffing ? `<span style="color: ${displayColor}; font-weight: bold;">Ref: ${match.ref}</span>` : 'Ref: ' + (match.ref || '-');

        let setsA = 0; let setsB = 0;
        if (match.s1A !== "" && match.s1B !== "") { parseInt(match.s1A) > parseInt(match.s1B) ? setsA++ : setsB++; }
        if (match.s2A !== "" && match.s2B !== "") { parseInt(match.s2A) > parseInt(match.s2B) ? setsA++ : setsB++; }
        if (setsA < 2 && setsB < 2 && match.s3A !== "" && match.s3B !== "") { parseInt(match.s3A) > parseInt(match.s3B) ? setsA++ : setsB++; }

        let teamAWon = isComplete && setsA > setsB;
        let teamBWon = isComplete && setsB > setsA;

        let badgeStyle = `display: inline-flex; align-items: center; justify-content: center; background: ${displayColor}; color: ${badgeTextColor}; width: 16px; height: 16px; border-radius: 50%; margin-left: 6px; font-size: 0.65rem; font-weight: bold; flex-shrink: 0;`;
        let badgeA = teamAWon ? `<span style="${badgeStyle}" title="Winner">✓</span>` : '';
        let badgeB = teamBWon ? `<span style="${badgeStyle}" title="Winner">✓</span>` : '';
        
        let nameStyleA = teamAWon ? 'font-weight: bold; color: var(--text-primary);' : (isComplete ? 'color: var(--text-secondary);' : 'font-weight: 600; color: var(--text-primary);');
        let nameStyleB = teamBWon ? 'font-weight: bold; color: var(--text-primary);' : (isComplete ? 'color: var(--text-secondary);' : 'font-weight: 600; color: var(--text-primary);');

        if (match.teamA === myTeam.name && (!isComplete || teamAWon)) nameStyleA = `color: ${displayColor}; font-weight: bold;`;
        if (match.teamB === myTeam.name && (!isComplete || teamBWon)) nameStyleB = `color: ${displayColor}; font-weight: bold;`;

        let h1 = getSetHighlight(match.s1A, match.s1B);
        let h2 = getSetHighlight(match.s2A, match.s2B);
        let h3 = getSetHighlight(match.s3A, match.s3B);

        let matchLabel = match.type && match.type !== 'Pool' ? `<span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: bold;">Match ${match.id}</span>` : '';

        return `
          <div class="data-card" style="padding: 12px; opacity: ${opacity}; ${borderHighlight} margin: 0; background: var(--surface-dark); border-radius: 6px;">
             <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                 <div style="display: flex; flex-direction: column; gap: 5px;">
                     <div style="display: flex; gap: 8px; align-items: center;">
                         <span style="font-size: 0.7rem; background: var(--surface-lighter); padding: 3px 6px; border-radius: 4px; color: var(--text-secondary); width: fit-content;">${match.status || 'Pending'}</span>
                         ${matchLabel}
                     </div>
                     ${refBadge}
                 </div>
                 <div style="display: flex; flex-direction: column; gap: 5px; text-align: right;">
                     <span style="font-size: 0.8rem; color: ${displayColor}; font-weight: bold;">🕒 ${formatTime(match.time)}</span>
                     <span style="font-size: 0.75rem; color: var(--text-secondary);">${refText}</span>
                 </div>
             </div>
             <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center;">
                <tr>
                   <td style="text-align: left; padding: 8px 0; ${nameStyleA}">
                       <div style="display: flex; align-items: center;">
                           <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${match.teamA}">${match.teamA}</span>
                           ${badgeA}
                       </div>
                   </td>
                   <td style="width: 16%;"><span style="${h1.a}">${match.s1A || '-'}</span></td>
                   <td style="width: 16%;"><span style="${h2.a}">${match.s2A || '-'}</span></td>
                   <td style="width: 16%;"><span style="${h3.a}">${match.s3A || '-'}</span></td>
                </tr>
                <tr>
                   <td style="text-align: left; padding: 8px 0; ${nameStyleB}">
                       <div style="display: flex; align-items: center;">
                           <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="${match.teamB}">${match.teamB}</span>
                           ${badgeB}
                       </div>
                   </td>
                   <td style="width: 16%;"><span style="${h1.b}">${match.s1B || '-'}</span></td>
                   <td style="width: 16%;"><span style="${h2.b}">${match.s2B || '-'}</span></td>
                   <td style="width: 16%;"><span style="${h3.b}">${match.s3B || '-'}</span></td>
                </tr>
             </table>
          </div>
        `;
    };

    let myMatches = myPool.matches.filter(m => m.teamA === myTeam.name || m.teamB === myTeam.name || m.ref === myTeam.name);
    
    html += `<h3 style="font-size: 1.1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-top: 25px;">Pool Schedule & Duties</h3>`;
    
    if (myMatches.length === 0) {
        html += `<p style="color: var(--text-secondary);">No pool matches scheduled yet.</p>`;
    } else {
        html += `<div class="matches-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 15px;">`;
        myMatches.forEach(match => {
            html += renderMatchCard(match);
        });
        html += `</div>`;
    }

    if (bracketMatches.length > 0) {
        html += `<h3 style="font-size: 1.1rem; color: var(--text-primary); margin-top: 25px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Bracket Matches</h3>`;
        html += `<div class="matches-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 15px;">`;
        
        bracketMatches.forEach(match => {
            html += renderMatchCard(match);
        });
        html += `</div>`;
    }

    html += `<div style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; font-style: italic; margin-top: 20px; padding-bottom: 20px;">* Times are estimates. Matches start when courts clear.</div>`;
    
    if (content) content.innerHTML = html;
}