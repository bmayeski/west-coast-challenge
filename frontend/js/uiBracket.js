// uiBracket.js
import { supabase } from './supabaseClient.js';
import { getPools, getTeams, getMatches, getTournamentData, getTournamentId } from './state.js';
import { getAllPoolStandings } from './uiMath.js';
import { ensureReadableColor } from './utils.js';

// SMART GATEKEEPER
const isSeedLocked = (poolId, rankIndex, poolStandings) => {
    const allMatches = getMatches();
    const poolTeams = poolStandings.map(t => t.id);
    if (poolTeams.length === 0) return false;

    const poolMatches = allMatches.filter(m => poolTeams.includes(m.teamA) || poolTeams.includes(m.teamB));
    if (poolMatches.length === 0) return false;

    const unfinished = poolMatches.filter(m => m.status !== 'completed' && m.status !== 'complete');
    if (unfinished.length === 0) return true;

    const team = poolStandings[rankIndex];
    if (!team) return false;
    if (team.isLocked || team.clinched) return true;

    const expectedMatches = poolTeams.length - 1; 
    if (team.matchesPlayed < expectedMatches) return false;

    const wins = team.matchesWon;
    if (rankIndex > 0) {
        const teamAbove = poolStandings[rankIndex - 1];
        if (teamAbove.matchesWon <= wins && teamAbove.matchesPlayed < expectedMatches) return false;
    }
    if (rankIndex < poolTeams.length - 1) {
        const teamBelow = poolStandings[rankIndex + 1];
        const maxPossibleWinsBelow = teamBelow.matchesWon + (expectedMatches - teamBelow.matchesPlayed);
        if (maxPossibleWinsBelow >= wins && teamBelow.matchesPlayed < expectedMatches) return false;
    }
    return true;
};

const formatTime = (startTime, durationMinutes, offsetMultiplier) => {
    if (!startTime) return 'TBD';
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + (durationMinutes * offsetMultiplier), 0);
    let h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
};

export function renderBracketView() {
    renderCanvas('bracketCanvas', 'bracketDivisionSelect', false);
    renderCanvas('adminBracketCanvas', 'adminBracketDivisionSelect', true);
}

export function populateBracketAdminConfig() {
    const tournamentData = getTournamentData(); 
    
    // Polling safeguard: Wait until data actually arrives
    if (!tournamentData || Object.keys(tournamentData).length === 0) {
        setTimeout(populateBracketAdminConfig, 200);
        return;
    }
    
    let existingConfig = tournamentData.bracket_config || {}; 
    
    if (typeof existingConfig === 'string') {
        try { existingConfig = JSON.parse(existingConfig); } catch(e) {}
    }

    const startInput = document.getElementById('bracketStartTime');
    if (startInput) startInput.value = existingConfig.start || '13:00';
    
    const durationInput = document.getElementById('bracketDuration');
    if (durationInput) durationInput.value = existingConfig.duration || '60';
    
    if (document.getElementById('locGold')) document.getElementById('locGold').value = existingConfig.locGold || '';
    if (document.getElementById('locSilver')) document.getElementById('locSilver').value = existingConfig.locSilver || '';
    if (document.getElementById('locBronze')) document.getElementById('locBronze').value = existingConfig.locBronze || '';
    if (document.getElementById('refMatch1')) document.getElementById('refMatch1').value = existingConfig.refMatch1 || 'pC:r2';
    if (document.getElementById('refMatch2')) document.getElementById('refMatch2').value = existingConfig.refMatch2 || 'pB:r2';
    
    const seedingInput = document.getElementById('hasSeedingRounds');
    // Fallback to the old column if the JSON object doesn't have it yet
    if (seedingInput) seedingInput.value = existingConfig.seeding || (tournamentData.has_seeding_rounds ? 'Yes' : 'No');
    
    const formatInput = document.getElementById('bracketFormat');
    if (formatInput) {
        // Fix the '1-Day' vs '1day' HTML mismatch
        let savedFormat = existingConfig.format || tournamentData.format || '1day';
        if (savedFormat === '1-Day') savedFormat = '1day';
        formatInput.value = savedFormat;
    }

    // Populate Advancement Routing
    if (existingConfig.routing) {
        document.querySelectorAll('.routing-select').forEach(select => {
            const rank = select.dataset.rank;
            if (existingConfig.routing[rank]) {
                select.value = existingConfig.routing[rank];
            }
        });
    }
}

function renderCanvas(canvasId, selectId, isAdmin) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.style.padding = '0';
    canvas.style.overflow = 'hidden';
    canvas.style.border = 'none';

    const tourneyData = getTournamentData();
    const config = tourneyData?.bracket_config || { start: '13:00', duration: 60 };
    const savedScores = tourneyData?.bracket_scores || {}; 
    const hasSeeding = config.seeding === 'Yes' || tourneyData?.has_seeding_rounds === true;

    const divisionSelect = document.getElementById(selectId);
    let selectedDivision = 'gold'; 
    
    if (divisionSelect) {
        const currentVal = divisionSelect.value || 'gold';
        let html = `<option value="gold" ${currentVal === 'gold' ? 'selected' : ''}>Gold Division${config.locGold ? ' - ' + config.locGold : ''}</option>`;
        html += `<option value="silver" ${currentVal === 'silver' ? 'selected' : ''}>Silver Division${config.locSilver ? ' - ' + config.locSilver : ''}</option>`;
        if (config.locBronze || currentVal === 'bronze') {
             html += `<option value="bronze" ${currentVal === 'bronze' ? 'selected' : ''}>Bronze Division${config.locBronze ? ' - ' + config.locBronze : ''}</option>`;
        }
        divisionSelect.innerHTML = html;
        selectedDivision = divisionSelect.value;

        if (!divisionSelect.dataset.listenerAttached) {
            divisionSelect.addEventListener('change', () => renderBracketView());
            divisionSelect.dataset.listenerAttached = 'true';
        }
    }

    const pools = getPools();
    const standingsByPool = getAllPoolStandings();

    const pA = pools[0]?.id || 'poolA';
    const pB = pools[1]?.id || 'poolB';
    const pC = pools[2]?.id || 'poolC';
    const pD = pools[3]?.id || 'poolD';

    let r1 = 1, r2 = 2; 
    let prefix = 'G';   
    if (selectedDivision === 'silver') {
        r1 = 3; r2 = 4; prefix = 'S';   
    } else if (selectedDivision === 'bronze') {
        r1 = 5; r2 = 6; prefix = 'B';
    }

    const timeSeed1 = formatTime(config.start, config.duration, 0); 
    const timeSeed2 = formatTime(config.start, config.duration, 1); 
    const qfTime1 = formatTime(config.start, config.duration, hasSeeding ? 2 : 0); 
    const qfTime2 = formatTime(config.start, config.duration, hasSeeding ? 3 : 1);
    const sfTime = formatTime(config.start, config.duration, hasSeeding ? 4 : 2);
    const finalTime = formatTime(config.start, config.duration, hasSeeding ? 5 : 3);

    const getRefSeed = (val) => {
        if (!val) return 'TBD';
        const [poolKey, rankKey] = val.split(':');
        const poolId = poolKey === 'pA' ? pA : poolKey === 'pB' ? pB : poolKey === 'pC' ? pC : pD;
        const rank = rankKey === 'r1' ? r1 : r2;
        return `seed:${poolId}:${rank}`;
    };

    const sVal = (id) => savedScores[id]?.setsA !== undefined ? savedScores[id].setsA : null;
    const sValB = (id) => savedScores[id]?.setsB !== undefined ? savedScores[id].setsB : null;

    let bracketData = [];

    if (hasSeeding) {
        bracketData = [
            // Seeding Round (S1 & S4 play first, S2 & S3 play second)
            // S1 is officiated by the bottom team of S2 (Pool D, Rank 1)
            { col: 'Seeding Round', time: timeSeed1, id: `${prefix}S1`, t1: `seed:${pA}:${r1}`, t2: `seed:${pB}:${r1}`, ref: `seed:${pD}:${r1}`, s1: sVal(`${prefix}S1`), s2: sValB(`${prefix}S1`) },
            { col: 'Seeding Round', time: timeSeed2, id: `${prefix}S2`, t1: `seed:${pC}:${r1}`, t2: `seed:${pD}:${r1}`, ref: `loser:${prefix}S1`, s1: sVal(`${prefix}S2`), s2: sValB(`${prefix}S2`) },
            { col: 'Seeding Round', time: timeSeed2, id: `${prefix}S3`, t1: `seed:${pA}:${r2}`, t2: `seed:${pB}:${r2}`, ref: `loser:${prefix}S4`, s1: sVal(`${prefix}S3`), s2: sValB(`${prefix}S3`) },
            // S4 is officiated by the bottom team of S3 (Pool B, Rank 2)
            { col: 'Seeding Round', time: timeSeed1, id: `${prefix}S4`, t1: `seed:${pC}:${r2}`, t2: `seed:${pD}:${r2}`, ref: `seed:${pB}:${r2}`, s1: sVal(`${prefix}S4`), s2: sValB(`${prefix}S4`) },
            
            // Quarterfinals
            { col: 'Quarterfinals', time: qfTime1, id: `${prefix}1`, t1: `winner:${prefix}S1`, t2: `loser:${prefix}S4`, ref: `loser:${prefix}S2`, s1: sVal(`${prefix}1`), s2: sValB(`${prefix}1`) },
            { col: 'Quarterfinals', time: qfTime2, id: `${prefix}2`, t1: `winner:${prefix}S3`, t2: `loser:${prefix}S2`, ref: `loser:${prefix}1`, s1: sVal(`${prefix}2`), s2: sValB(`${prefix}2`) },
            { col: 'Quarterfinals', time: qfTime2, id: `${prefix}3`, t1: `winner:${prefix}S2`, t2: `loser:${prefix}S3`, ref: `loser:${prefix}4`, s1: sVal(`${prefix}3`), s2: sValB(`${prefix}3`) },
            { col: 'Quarterfinals', time: qfTime1, id: `${prefix}4`, t1: `winner:${prefix}S4`, t2: `loser:${prefix}S1`, ref: `loser:${prefix}S3`, s1: sVal(`${prefix}4`), s2: sValB(`${prefix}4`) },
            
            // Semifinals
            { col: 'Semifinals', time: sfTime, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2`, s1: sVal(`${prefix}5`), s2: sValB(`${prefix}5`) },
            { col: 'Semifinals', time: sfTime, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3`, s1: sVal(`${prefix}6`), s2: sValB(`${prefix}6`) },
            
            // Finals
            { col: 'Finals', time: finalTime, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5`, s1: sVal(`${prefix}7`), s2: sValB(`${prefix}7`) }
        ];
    } else {
        bracketData = [
            // Standard Quarterfinals (1v8, 4v5, 3v6, 2v7 equivalent from pool rankings)
            // Q1 is officiated by the bottom team of Q2 (Pool C, Rank 2)
            { col: 'Quarterfinals', time: qfTime1, id: `${prefix}1`, t1: `seed:${pA}:${r1}`, t2: `seed:${pB}:${r2}`, ref: `seed:${pC}:${r2}`, s1: sVal(`${prefix}1`), s2: sValB(`${prefix}1`) },
            { col: 'Quarterfinals', time: qfTime2, id: `${prefix}2`, t1: `seed:${pD}:${r1}`, t2: `seed:${pC}:${r2}`, ref: `loser:${prefix}1`, s1: sVal(`${prefix}2`), s2: sValB(`${prefix}2`) },
            { col: 'Quarterfinals', time: qfTime2, id: `${prefix}3`, t1: `seed:${pC}:${r1}`, t2: `seed:${pD}:${r2}`, ref: `loser:${prefix}4`, s1: sVal(`${prefix}3`), s2: sValB(`${prefix}3`) },
            // Q4 is officiated by the bottom team of Q3 (Pool D, Rank 2)
            { col: 'Quarterfinals', time: qfTime1, id: `${prefix}4`, t1: `seed:${pB}:${r1}`, t2: `seed:${pA}:${r2}`, ref: `seed:${pD}:${r2}`, s1: sVal(`${prefix}4`), s2: sValB(`${prefix}4`) },
            
            // Semifinals
            { col: 'Semifinals', time: sfTime, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2`, s1: sVal(`${prefix}5`), s2: sValB(`${prefix}5`) },
            { col: 'Semifinals', time: sfTime, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3`, s1: sVal(`${prefix}6`), s2: sValB(`${prefix}6`) },
            
            // Finals
            { col: 'Finals', time: finalTime, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5`, s1: sVal(`${prefix}7`), s2: sValB(`${prefix}7`) }
        ];
    }

    const resolveTeam = (teamRef) => {
        if (!teamRef) return { name: 'TBD', color: '#64748b', logo: null, resolved: false };
        if (typeof teamRef === 'string' && teamRef.startsWith('seed:')) {
            const parts = teamRef.split(':');
            const poolId = parts[1];
            const rankIndex = parseInt(parts[2]) - 1;
            const poolName = pools.find(p => p.id === poolId)?.name || 'Pool';
            const rankStr = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
            const poolStandings = standingsByPool[poolId] || [];

            if (isSeedLocked(poolId, rankIndex, poolStandings)) {
                if (poolStandings[rankIndex]) {
                    const team = poolStandings[rankIndex];
                    return { name: team.name, color: team.color, logo: team.logo_id, resolved: true };
                }
            }
            return { name: `${rankStr} ${poolName}`, color: '#64748b', logo: null, resolved: false };
        }
        if (typeof teamRef === 'string' && (teamRef.startsWith('winner:') || teamRef.startsWith('loser:'))) {
            const [type, matchId] = teamRef.split(':');
            const targetMatch = bracketData.find(m => m.id === matchId);
            if (targetMatch && targetMatch.s1 !== null && targetMatch.s2 !== null) {
                if (targetMatch.s1 !== targetMatch.s2) {
                    const team1 = resolveTeam(targetMatch.t1);
                    const team2 = resolveTeam(targetMatch.t2);
                    if (team1.resolved && team2.resolved) {
                        if (type === 'winner') return targetMatch.s1 > targetMatch.s2 ? team1 : team2;
                        else return targetMatch.s1 > targetMatch.s2 ? team2 : team1;
                    }
                }
            }
            const typeStr = type === 'winner' ? 'Winner' : 'Loser';
            return { name: `${typeStr} Match ${matchId.replace(prefix, '')}`, color: '#64748b', logo: null, resolved: false };
        }
        return { name: teamRef, color: '#64748b', logo: null, resolved: false };
    };

    const bracketStyles = `
        <style>
            .bracket-viewport-class { width: 100%; height: 100%; min-height: 350px; background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; cursor: grab; user-select: none; }
            .bracket-viewport-class:active { cursor: grabbing; }
            .bracket-surface-class { display: inline-block; padding: 10px; transform-origin: 0 0; transition: transform 0.1s ease-out; }
            .bracket-tree { display: flex; gap: 20px; align-items: stretch; min-width: max-content; }
            .bracket-column { display: flex; flex-direction: column; } 
            .bracket-matches { display: flex; flex-direction: column; flex-grow: 1; justify-content: space-around; gap: 8px; }
            .bracket-col-title { color: var(--accent-orange); font-weight: bold; font-size: 0.8rem; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
            .bracket-card { width: 220px; background: #1e293b; border-radius: 6px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
            .bracket-header { display: flex; justify-content: space-between; align-items: center; padding: 3px 8px; background: #0f172a; border-bottom: 1px solid #334155; }
            .bracket-time { color: var(--accent-orange); font-size: 0.7rem; font-weight: bold; pointer-events: none; }
            .bracket-id { color: #64748b; font-size: 0.65rem; font-weight: bold; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; pointer-events: none; }
            .bracket-teams-container { padding: 3px; border-bottom: 1px solid #334155; display: flex; flex-direction: column; gap: 1px; }
            .bracket-team-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 4px; border: 1px solid transparent; }
            .bracket-team-info { display: flex; align-items: center; gap: 6px; color: white; font-size: 0.8rem; font-weight: bold; pointer-events: none; }
            .bracket-score { font-weight: bold; font-size: 0.85rem; pointer-events: none; }
            .bracket-ref { text-align: center; padding: 3px; font-size: 0.65rem; color: #64748b; pointer-events: none; }
            .bracket-ref-team { color: var(--accent-orange); font-weight: bold; }
        </style>
    `;

    const createMatchCard = (match) => {
        const team1 = resolveTeam(match.t1);
        const team2 = resolveTeam(match.t2);
        const refTeam = resolveTeam(match.ref);

        const isT1Winner = match.s1 !== null && match.s2 !== null && match.s1 > match.s2;
        const isT2Winner = match.s1 !== null && match.s2 !== null && match.s2 > match.s1;

        const t1Text = (isT1Winner || (!isT1Winner && !isT2Winner && team1.resolved)) ? 'color: white;' : 'color: #94a3b8; font-weight: normal;';
        const t2Text = (isT2Winner || (!isT1Winner && !isT2Winner && team2.resolved)) ? 'color: white;' : 'color: #94a3b8; font-weight: normal;';
        
        const t1RowStyle = isT1Winner ? 'background: color-mix(in srgb, var(--accent-orange) 15%, transparent); border: 1px solid var(--accent-orange);' : '';
        const t2RowStyle = isT2Winner ? 'background: color-mix(in srgb, var(--accent-orange) 15%, transparent); border: 1px solid var(--accent-orange);' : '';
        
        const renderTeamBadge = (team) => {
            if (!team.resolved) return '';
            if (team.logo) return `<img src="${team.logo}" style="width: 14px; height: 14px; object-fit: contain; border-radius: 50%;">`;
            return `<div style="width: 14px; height: 14px; border-radius: 50%; background: ${team.color || '#475569'};"></div>`;
        };

        const adminEditButton = isAdmin ? `
            <button class="btn edit-bracket-match-btn" data-match-id="${match.id}" data-t1="${team1.name}" data-t2="${team2.name}" 
            style="width: 100%; padding: 4px; font-size: 0.75rem; background: rgba(255,255,255,0.05); color: white; border: 1px solid #334155; cursor: pointer; border-radius: 0;">
            ✏️ Edit Match
            </button>
        ` : '';

        // Extract raw set scores from the database object
        const raw = savedScores[match.id] || {};
        let scoresText = [];
        if (raw.s1A != null && raw.s1B != null) scoresText.push(`${raw.s1A}-${raw.s1B}`);
        if (raw.s2A != null && raw.s2B != null) scoresText.push(`${raw.s2A}-${raw.s2B}`);
        if (raw.s3A != null && raw.s3B != null) scoresText.push(`${raw.s3A}-${raw.s3B}`);
        const scoresDisplay = scoresText.join(' <span style="color:#475569;">|</span> ');

        return `
        <div class="bracket-card">
            <div class="bracket-header">
                <span class="bracket-time">🕒 ${match.time}</span>
                <span class="bracket-id">Match ${match.id.replace(prefix, '')}</span>
            </div>
            <div class="bracket-teams-container">
                <div class="bracket-team-row" style="${t1RowStyle}">
                    <div class="bracket-team-info" style="${t1Text}">
                        ${renderTeamBadge(team1)} ${team1.name}
                    </div>
                    <span class="bracket-score" style="${t1Text}">${match.s1 !== null ? match.s1 : '-'}</span>
                </div>
                <div class="bracket-team-row" style="${t2RowStyle}">
                    <div class="bracket-team-info" style="${t2Text}">
                        ${renderTeamBadge(team2)} ${team2.name}
                    </div>
                    <span class="bracket-score" style="${t2Text}">${match.s2 !== null ? match.s2 : '-'}</span>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-size: 0.65rem; color: #64748b; background: rgba(0,0,0,0.15);">
                <div>Ref: <span class="bracket-ref-team">${refTeam.name}</span></div>
                <div style="color: #94a3b8; font-weight: 500; letter-spacing: 0.5px;">${scoresDisplay}</div>
            </div>
            ${adminEditButton}
        </div>
        `;
    };

    let columnsHtml = '';
    const visibleColumns = hasSeeding ? ['Seeding Round', 'Quarterfinals', 'Semifinals', 'Finals'] : ['Quarterfinals', 'Semifinals', 'Finals'];
    
    visibleColumns.forEach(colName => {
        const colMatches = bracketData.filter(m => m.col === colName);
        if (colMatches.length > 0) {
            columnsHtml += `
            <div class="bracket-column">
                <div class="bracket-col-title">${colName}</div>
                <div class="bracket-matches">
                    ${colMatches.map(m => createMatchCard(m)).join('')}
                </div>
            </div>`;
        }
    });

    canvas.innerHTML = `
        ${bracketStyles}
        <div id="${canvasId}-viewport" class="bracket-viewport-class">
            <div id="${canvasId}-surface" class="bracket-surface-class">
                <div class="bracket-tree">
                    ${columnsHtml}
                </div>
            </div>
        </div>
    `;

    initPanAndZoom(canvasId);
}

function initPanAndZoom(canvasId) {
    const viewport = document.getElementById(`${canvasId}-viewport`);
    const surface = document.getElementById(`${canvasId}-surface`);
    if (!viewport || !surface) return;

    let scale = 1, translateX = 0, translateY = 0, isDragging = false, startX, startY;

    const applyTransform = () => surface.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        const newScale = Math.min(Math.max(0.4, scale + ((e.deltaY < 0 ? 1 : -1) * 0.1)), 2.0); 
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        translateX = mouseX - (mouseX - translateX) * (newScale / scale);
        translateY = mouseY - (mouseY - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
    }, { passive: false });

    viewport.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        surface.style.transition = 'none'; 
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    const stopDragging = () => {
        if (isDragging) {
            isDragging = false;
            surface.style.transition = 'transform 0.1s ease-out'; 
        }
    };

    viewport.addEventListener('mouseup', stopDragging);
    viewport.addEventListener('mouseleave', stopDragging);
}

export function initBracketAdmin() {
    populateBracketAdminConfig();

    const saveConfigBtn = document.getElementById('saveBracketConfigBtn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
            const start = document.getElementById('bracketStartTime').value;
            const duration = parseInt(document.getElementById('bracketDuration').value, 10);
            const locGold = document.getElementById('locGold').value.trim();
            const locSilver = document.getElementById('locSilver').value.trim();
            const locBronze = document.getElementById('locBronze').value.trim();
            const refMatch1 = document.getElementById('refMatch1').value;
            const refMatch2 = document.getElementById('refMatch2').value;
            
            const format = document.getElementById('bracketFormat')?.value || '1day';
            const seeding = document.getElementById('hasSeedingRounds')?.value || 'No';
            
            // Gather Routing Assignments
            const routing = {};
            document.querySelectorAll('.routing-select').forEach(select => {
                routing[select.dataset.rank] = select.value;
            });

            // Put EVERYTHING in the JSON object
            const configObj = { 
                start, duration, locGold, locSilver, locBronze, refMatch1, refMatch2,
                format, seeding, routing
            };
            
            const tournamentId = getTournamentId();
            if (!tournamentId) return;

            const originalText = saveConfigBtn.innerText;
            saveConfigBtn.innerText = 'Saving to Database...';

            const { error } = await supabase
                .from('tournaments')
                .update({ bracket_config: configObj })
                .eq('id', tournamentId);
                
            if (error) {
                alert("Error saving settings: " + error.message);
                saveConfigBtn.innerText = originalText;
                return;
            }
            
            const tournamentData = getTournamentData();
            if (tournamentData) {
                tournamentData.bracket_config = configObj;
            }

            saveConfigBtn.innerText = '✅ Configuration Saved!';
            saveConfigBtn.style.backgroundColor = '#22c55e'; 
            setTimeout(() => {
                saveConfigBtn.innerText = 'Save Settings';
                saveConfigBtn.style.backgroundColor = 'var(--accent-orange)';
            }, 2000);
            
            renderBracketView();
        });
    }

    document.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-bracket-match-btn');
        if (editBtn) {
            const matchId = editBtn.dataset.matchId;
            document.getElementById('bracketScoreMatchId').value = matchId;
            document.getElementById('bracketScoreModalMatchup').innerText = `${editBtn.dataset.t1} vs ${editBtn.dataset.t2}`;
            
            const tourneyData = getTournamentData();
            const savedScores = tourneyData?.bracket_scores || {};
            const existing = savedScores[matchId] || {};
            
            document.getElementById('bs1A').value = existing.s1A ?? '';
            document.getElementById('bs1B').value = existing.s1B ?? '';
            document.getElementById('bs2A').value = existing.s2A ?? '';
            document.getElementById('bs2B').value = existing.s2B ?? '';
            document.getElementById('bs3A').value = existing.s3A ?? '';
            document.getElementById('bs3B').value = existing.s3B ?? '';

            document.getElementById('editBracketScoreModal').style.display = 'flex';
        }

        if (e.target.closest('#closeBracketScoreModalBtn')) {
            document.getElementById('editBracketScoreModal').style.display = 'none';
        }

        if (e.target.closest('#saveBracketScoresBtn')) {
            const saveBtn = e.target.closest('#saveBracketScoresBtn');
            const originalText = saveBtn.innerText;
            saveBtn.innerText = 'Saving...';

            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const matchId = document.getElementById('bracketScoreMatchId').value;
            const getVal = (id) => { const v = parseInt(document.getElementById(id).value, 10); return isNaN(v) ? null : v; };
            
            const s1A = getVal('bs1A'); const s1B = getVal('bs1B');
            const s2A = getVal('bs2A'); const s2B = getVal('bs2B');
            const s3A = getVal('bs3A'); const s3B = getVal('bs3B');

            let setsA = 0; let setsB = 0;
            if (s1A !== null && s1B !== null) { if (s1A > s1B) setsA++; else if (s1B > s1A) setsB++; }
            if (s2A !== null && s2B !== null) { if (s2A > s2B) setsA++; else if (s2B > s2A) setsB++; }
            if (s3A !== null && s3B !== null) { if (s3A > s3B) setsA++; else if (s3B > s3A) setsB++; }

            const savedScores = tourneyData.bracket_scores || {};
            savedScores[matchId] = { s1A, s1B, s2A, s2B, s3A, s3B, setsA, setsB };

            const { error } = await supabase
                .from('tournaments')
                .update({ bracket_scores: savedScores })
                .eq('id', tournamentId);

            if (error) {
                alert("Error saving score: " + error.message);
                saveBtn.innerText = originalText;
                return;
            }

            tourneyData.bracket_scores = savedScores;
            saveBtn.innerText = originalText;
            document.getElementById('editBracketScoreModal').style.display = 'none';
            renderBracketView();
        }

        if (e.target.closest('#deleteBracketScoresBtn')) {
            if (!confirm("Clear scores for this bracket match? This may pull teams out of the next round.")) return;
            
            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const matchId = document.getElementById('bracketScoreMatchId').value;
            const savedScores = tourneyData.bracket_scores || {};
            
            delete savedScores[matchId];

            const { error } = await supabase
                .from('tournaments')
                .update({ bracket_scores: savedScores })
                .eq('id', tournamentId);

            if (error) {
                alert("Error deleting score: " + error.message);
                return;
            }

            tourneyData.bracket_scores = savedScores;
            document.getElementById('editBracketScoreModal').style.display = 'none';
            renderBracketView();
        }
    });
}