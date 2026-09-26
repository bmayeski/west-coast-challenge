// uiBracket.js
import { supabase } from './supabaseClient.js';
import { getPools, getTeams, getMatches, getTournamentData, getTournamentId } from './state.js';
import { getAllPoolStandings } from './uiMath.js';

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

const addMinutesToTime = (timeStr, minsToAdd) => {
    if (!timeStr || !timeStr.includes(':')) return '00:00';
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + minsToAdd, 0);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const formatDisplayTime = (time24) => {
    if (!time24 || !time24.includes(':')) return 'TBD';
    let [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export function renderBracketView() {
    renderCanvas('bracketCanvas', 'bracketDivisionSelect', false);
    renderCanvas('adminBracketCanvas', 'adminBracketDivisionSelect', true);
}

export function populateBracketAdminConfig() {
    const tournamentData = getTournamentData(); 
    
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
    
    const poolDurInput = document.getElementById('poolDuration');
    if (poolDurInput) poolDurInput.value = existingConfig.poolDuration || '60';

    const bracketDurInput = document.getElementById('bracketDuration');
    if (bracketDurInput) bracketDurInput.value = existingConfig.bracketDuration || '60';
    
    const seedingInput = document.getElementById('hasSeedingRounds');
    if (seedingInput) seedingInput.value = existingConfig.seeding || (tournamentData.has_seeding_rounds ? 'Yes' : 'No');
    
    const formatInput = document.getElementById('bracketFormat');
    if (formatInput) {
        let savedFormat = existingConfig.format || tournamentData.format || '1day';
        if (savedFormat === '1-Day') savedFormat = '1day';
        formatInput.value = savedFormat;
    }

    const divInput = document.getElementById('bracketDivisions');
    if (divInput) divInput.value = existingConfig.divisions || '2';

    // NEW: Load the saved Bracket Sets configuration (defaults to 1)
    const bracketSetsInput = document.getElementById('bracketSetsConfig');
    if (bracketSetsInput) bracketSetsInput.value = existingConfig.bracketSets || '1';

    const site1Name = document.getElementById('site1Name');
    if (site1Name) site1Name.value = existingConfig.site1Name || '';
    const site1Color = document.getElementById('site1Color');
    const site1Hex = document.getElementById('site1Hex');
    if (site1Color && site1Hex) {
        site1Color.value = existingConfig.site1Color || '#3b82f6';
        site1Hex.value = existingConfig.site1Color || '#3b82f6';
    }

    const site2Name = document.getElementById('site2Name');
    if (site2Name) site2Name.value = existingConfig.site2Name || '';
    const site2Color = document.getElementById('site2Color');
    const site2Hex = document.getElementById('site2Hex');
    if (site2Color && site2Hex) {
        site2Color.value = existingConfig.site2Color || '#ef4444';
        site2Hex.value = existingConfig.site2Color || '#ef4444';
    }

    const site3Name = document.getElementById('site3Name');
    if (site3Name) site3Name.value = existingConfig.site3Name || '';
    const site3Color = document.getElementById('site3Color');
    const site3Hex = document.getElementById('site3Hex');
    if (site3Color && site3Hex) {
        site3Color.value = existingConfig.site3Color || '#22c55e';
        site3Hex.value = existingConfig.site3Color || '#22c55e';
    }
}

export function renderCanvas(canvasId, selectId, isAdmin) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.style.padding = '0';
    canvas.style.overflow = 'hidden';
    canvas.style.border = 'none';

    const tourneyData = getTournamentData();
    const config = tourneyData?.bracket_config || { start: '13:00', bracketDuration: 60, poolDuration: 60, divisions: '2' };
    const savedScores = tourneyData?.bracket_scores || {}; 
    const activeDivisions = config.divisions || '2';

    const divisionSelect = document.getElementById(selectId);
    let selectedDivision = 'gold'; 
    
    if (divisionSelect) {
        const currentVal = divisionSelect.value || 'gold';
        let html = `<option value="gold" ${currentVal === 'gold' ? 'selected' : ''}>Gold Division</option>`;
        html += `<option value="silver" ${currentVal === 'silver' ? 'selected' : ''}>Silver Division</option>`;
        
        if (activeDivisions === '3') {
            html += `<option value="bronze" ${currentVal === 'bronze' ? 'selected' : ''}>Bronze Division</option>`;
        }
        
        divisionSelect.innerHTML = html;
        selectedDivision = divisionSelect.value;

        if (selectedDivision === 'bronze' && activeDivisions !== '3') {
            selectedDivision = 'gold';
            divisionSelect.value = 'gold';
        }

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
    
    const pB_site = pools.find(p => p.id === pB)?.site || '';
    const pC_site = pools.find(p => p.id === pC)?.site || '';

    const bDur = parseInt(config.bracketDuration || 60, 10);
    const t0 = addMinutesToTime(config.start, 0);
    const t1 = addMinutesToTime(config.start, bDur * 1);
    const t2 = addMinutesToTime(config.start, bDur * 2);
    const t3 = addMinutesToTime(config.start, bDur * 3);

    let bracketData = [];

    // --- DIRECTOR'S CUSTOM 14-TEAM BRACKET LOGIC ---
    if (selectedDivision === 'gold') {
        bracketData = [
            // Quarterfinals in strict numerical match order (1 through 4)
            { col: 'Quarterfinals', rawTime: t0, id: 'G1', t1: `seed:${pA}:1`, t2: `seed:${pB}:2`, ref: `seed:${pA}:3` },
            { col: 'Quarterfinals', rawTime: t0, id: 'G2', t1: `seed:${pD}:1`, t2: `seed:${pC}:2`, ref: `seed:${pD}:3` },
            { col: 'Quarterfinals', rawTime: t0, id: 'G3', t1: `seed:${pC}:1`, t2: `seed:${pD}:2`, ref: `seed:${pC}:3` },
            { col: 'Quarterfinals', rawTime: t0, id: 'G4', t1: `seed:${pB}:1`, t2: `seed:${pA}:2`, ref: `seed:${pB}:3` },

            // Semifinals (Updated to perfectly match the visual pairs)
            { col: 'Semifinals', rawTime: t1, id: 'G5', t1: `winner:G1`, t2: `winner:G2`, ref: `loser:G1` },
            { col: 'Semifinals', rawTime: t1, id: 'G6', t1: `winner:G3`, t2: `winner:G4`, ref: `loser:G4` },

            // Finals
            { col: 'Finals', rawTime: t2, id: 'G7', t1: `winner:G5`, t2: `winner:G6`, ref: `loser:G5` }
        ];
    } else if (selectedDivision === 'silver') {
        bracketData = [
            // Silver Quarterfinals (Play-ins paired with Visual Byes)
            { col: 'Quarterfinals', rawTime: t0, id: 'S1', t1: `seed:${pA}:3`, t2: `seed:${pB}:4`, ref: `loser:G1` },
            { col: 'Quarterfinals', rawTime: t0, id: 'S_Bye1', t1: `seed:${pC}:3`, t2: `BYE`, isBye: true, feedsTo: 'S3', site: pC_site },
            
            { col: 'Quarterfinals', rawTime: t0, id: 'S2', t1: `seed:${pC}:4`, t2: `seed:${pD}:3`, ref: `loser:G3` },
            { col: 'Quarterfinals', rawTime: t0, id: 'S_Bye2', t1: `seed:${pB}:3`, t2: `BYE`, isBye: true, feedsTo: 'S4', site: pB_site },

            // Silver Semifinals (Play-in winners take Top, Auto-advancers take Bottom)
            { col: 'Semifinals', rawTime: t1, id: 'S3', t1: `winner:S1`, t2: `seed:${pC}:3`, ref: `loser:S1` },
            { col: 'Semifinals', rawTime: t1, id: 'S4', t1: `winner:S2`, t2: `seed:${pB}:3`, ref: `loser:S2` },

            // Silver Finals
            { col: 'Finals', rawTime: t2, id: 'S5', t1: `winner:S3`, t2: `winner:S4`, ref: `loser:S3` }
        ];
    }

    bracketData = bracketData.map(m => {
        const raw = savedScores[m.id] || {};
        return {
            ...m,
            time24: raw.timeOverride || m.rawTime,
            ref: raw.refOverride || m.ref,
            site: raw.siteOverride || m.site,
            court: raw.courtOverride || null,
            s1: raw.setsA !== undefined ? raw.setsA : null,
            s2: raw.setsB !== undefined ? raw.setsB : null
        };
    });

    if (isAdmin) {
        window.activeBracketState = bracketData;
    }

    const resolveTeam = (teamRef) => {
        if (!teamRef) return { name: 'TBD', color: '#64748b', logo: null, resolved: false };
        
        const teams = getTeams();
        const teamObj = teams.find(t => t.id === teamRef);
        if (teamObj) return { name: teamObj.name, color: teamObj.color, logo: teamObj.logo_id, resolved: true };

        if (typeof teamRef === 'string' && teamRef.startsWith('seed:')) {
            const parts = teamRef.split(':');
            const poolId = parts[1];
            const rankIndex = parseInt(parts[2]) - 1;
            const poolName = pools.find(p => p.id === poolId)?.name || 'Pool';
            const rankStr = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
            const poolStandings = standingsByPool[poolId] || [];

            let isLocked = false;
            if (poolStandings.length > 0 && poolStandings[rankIndex]) {
                const expectedMatches = poolStandings.length === 3 ? 2 : 3;
                
                const getPlayed = (t) => t.matchesPlayed !== undefined ? t.matchesPlayed : ((t.mw || 0) + (t.ml || 0));
                const getWins = (t) => t.matchesWon !== undefined ? t.matchesWon : (t.mw || 0);
                
                const team = poolStandings[rankIndex];
                const teamPlayed = getPlayed(team);
                const teamWins = getWins(team);

                // Mathematical Clinch Logic
                if (teamPlayed >= expectedMatches) {
                    isLocked = true;
                    // 1. Ensure teams above cannot drop below them
                    for (let i = 0; i < rankIndex; i++) {
                        const above = poolStandings[i];
                        if (getPlayed(above) < expectedMatches && getWins(above) <= teamWins) isLocked = false;
                    }
                    // 2. Ensure teams below cannot theoretically catch up
                    for (let i = rankIndex + 1; i < poolStandings.length; i++) {
                        const below = poolStandings[i];
                        const belowPlayed = getPlayed(below);
                        if (belowPlayed < expectedMatches && (getWins(below) + (expectedMatches - belowPlayed)) >= teamWins) isLocked = false;
                    }
                }
            }

            if (isLocked) {
                const team = poolStandings[rankIndex];
                return { name: team.name, color: team.color, logo: team.logo_id, resolved: true };
            }
            
            return { name: `${rankStr} ${poolName}`, color: '#64748b', logo: null, resolved: false };
        }
        
        if (typeof teamRef === 'string' && (teamRef.startsWith('winner:') || teamRef.startsWith('loser:'))) {
            const [type, matchId] = teamRef.split(':');
            
            const targetPrefix = matchId.charAt(0);
            const targetNum = matchId.slice(1);
            
            const typeStr = type === 'winner' ? 'Winner' : 'Loser';
            const fallbackName = `${typeStr} Match ${targetNum}`;
            
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
            return { name: fallbackName, color: '#64748b', logo: null, resolved: false };
        }
        return { name: teamRef, color: '#64748b', logo: null, resolved: false };
    };

    const bracketStyles = `
        <style>
            .bracket-viewport-class { width: 100%; height: 100%; min-height: 350px; background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; cursor: grab; user-select: none; touch-action: none; }
            .bracket-viewport-class:active { cursor: grabbing; }
            .bracket-surface-class { display: inline-block; padding: 10px; transform-origin: 0 0; transition: transform 0.1s ease-out; }
            .bracket-tree { display: flex; gap: 80px; align-items: stretch; min-width: max-content; }
            .bracket-column { display: flex; flex-direction: column; width: 240px; } 
            .bracket-matches { display: flex; flex-direction: column; flex-grow: 1; margin: 0; padding: 10px 0; }
            .bracket-col-title { color: var(--accent-orange); font-weight: bold; font-size: 0.8rem; text-align: center; margin-bottom: 2px; text-transform: uppercase; }
            .bracket-card { width: 100%; background: #1e293b; border-radius: 6px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; flex-direction: row; z-index: 2; position: relative; }
            .bracket-header { display: flex; justify-content: space-between; align-items: center; padding: 3px 8px; background: #0f172a; border-bottom: 1px solid #334155; }
            .bracket-time { font-size: 0.7rem; font-weight: bold; pointer-events: none; }
            .bracket-id { color: #64748b; font-size: 0.65rem; font-weight: bold; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; pointer-events: none; }
            .bracket-teams-container { padding: 3px; border-bottom: 1px solid #334155; display: flex; flex-direction: column; gap: 1px; }
            .bracket-team-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 4px; border: 1px solid transparent; }
            .bracket-team-info { display: flex; align-items: center; gap: 6px; color: white; font-size: 0.8rem; font-weight: bold; pointer-events: none; }
            .bracket-score { font-weight: bold; font-size: 0.85rem; pointer-events: none; }
            .bracket-ref-team { font-weight: bold; }
        </style>
    `;

    const getSiteColor = (siteName) => {
        if (!siteName) return '#475569'; 
        if (siteName === config.site1Name) return config.site1Color || '#3b82f6';
        if (siteName === config.site2Name) return config.site2Color || '#ef4444';
        if (siteName === config.site3Name) return config.site3Color || '#22c55e';
        return '#475569';
    };

    const visibleColumns = ['Quarterfinals', 'Semifinals', 'Finals'];

    const createMatchCard = (match, index, colIndex, isStraight) => {
        
        // --- Custom Styling for Bye Matches ---
        if (match.isBye) {
            const team1 = resolveTeam(match.t1);
            const textAccent = match.site ? getSiteColor(match.site) : 'var(--accent-orange)';
            let locationBadge = '';
            if (match.site) {
                locationBadge = `<div style="background: color-mix(in srgb, ${textAccent} 15%, transparent); color: ${textAccent}; font-size: 0.65rem; text-align: center; padding: 4px; border-top: 1px dashed #475569; font-weight: bold; letter-spacing: 0.5px; margin-top: auto;">📍 Origin: ${match.site}</div>`;
            }
            
            let feederLine = '';
            if (colIndex < visibleColumns.length - 1) { 
                const startColor = getSiteColor(match.site);
                let endColor = '#475569';
                
                const nextM = bracketData.find(n => n.id === match.feedsTo);
                if (nextM && nextM.site) endColor = getSiteColor(nextM.site);

                const lineWidth = '3';
                const isTop = index % 2 === 0;
                const topCss = isTop ? 'top: 50%;' : 'bottom: 50%;';
                const d = isTop ? 'M 0,0 C 50,0 50,100 100,100' : 'M 0,100 C 50,100 50,0 100,0';

                feederLine = `
                <div style="position: absolute; left: 100%; ${topCss} width: 80px; height: 50%; z-index: 0; pointer-events: none;">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow: visible; position: absolute; top: 0; left: 0;">
                        <defs>
                            <linearGradient id="grad_${canvasId}_${match.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="${startColor}" />
                                <stop offset="100%" stop-color="${endColor}" />
                            </linearGradient>
                        </defs>
                        <path d="${d}" fill="none" stroke="url(#grad_${canvasId}_${match.id})" stroke-width="${lineWidth}" vector-effect="non-scaling-stroke" stroke-dasharray="4" />
                    </svg>
                </div>
                `;
            }

            return `
            <div class="match-slot" style="display: flex; flex-direction: column; justify-content: center; position: relative; flex: 1; width: 100%; min-height: 90px; padding: 6px 0; box-sizing: border-box;">
                <div class="bracket-card" style="border: 1px dashed #475569; background: rgba(30, 41, 59, 0.5);">
                    <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
                        <div class="bracket-header" style="background: transparent; justify-content: center; border-bottom: none; padding-top: 8px;">
                            <span class="bracket-id" style="color: #94a3b8; font-size: 0.6rem; letter-spacing: 1px;">AUTO-ADVANCE (BYE)</span>
                        </div>
                        <div class="bracket-teams-container" style="border-bottom: none; justify-content: center; padding: 4px 10px 10px 10px;">
                            <div class="bracket-team-info" style="color: white; justify-content: center; font-size: 0.9rem;">
                                ${team1.name}
                            </div>
                        </div>
                        ${locationBadge}
                    </div>
                </div>
                ${feederLine}
            </div>
            `;
        }

        // --- Standard Match Card Logic ---
        const team1 = resolveTeam(match.t1);
        const team2 = resolveTeam(match.t2);
        const refTeam = resolveTeam(match.ref);

        const isT1Winner = match.s1 !== null && match.s2 !== null && match.s1 > match.s2;
        const isT2Winner = match.s1 !== null && match.s2 !== null && match.s2 > match.s1;

        const t1Text = (isT1Winner || (!isT1Winner && !isT2Winner && team1.resolved)) ? 'color: white;' : 'color: #94a3b8; font-weight: normal;';
        const t2Text = (isT2Winner || (!isT1Winner && !isT2Winner && team2.resolved)) ? 'color: white;' : 'color: #94a3b8; font-weight: normal;';
        
        const textAccent = match.site ? getSiteColor(match.site) : 'var(--accent-orange)';
        
        const t1RowStyle = isT1Winner ? `background: color-mix(in srgb, ${textAccent} 15%, transparent); border: 1px solid ${textAccent};` : '';
        const t2RowStyle = isT2Winner ? `background: color-mix(in srgb, ${textAccent} 15%, transparent); border: 1px solid ${textAccent};` : '';

        let adminEditButton = '';
        if (isAdmin) {
            adminEditButton = `
            <div style="display: flex; flex-direction: column; width: 32px; flex-shrink: 0; border-left: 1px solid #334155; background: rgba(0,0,0,0.2);">
                <button class="btn edit-bracket-details-btn" data-match-id="${match.id}" data-t1="${team1.name}" data-t2="${team2.name}" data-time="${match.time24}" data-site="${match.site || ''}" data-court="${match.court || ''}" 
                style="flex: 1; padding: 0; font-size: 1.1rem; border: none; border-bottom: 1px solid #334155; cursor: pointer; border-radius: 0; background: transparent; display: flex; align-items: center; justify-content: center;" title="Edit Match Details">
                ⚙️
                </button>
                <button class="btn edit-bracket-score-btn" data-match-id="${match.id}" data-t1="${team1.name}" data-t2="${team2.name}" 
                style="flex: 1; padding: 0; font-size: 1.1rem; border: none; cursor: pointer; border-radius: 0; background: transparent; display: flex; align-items: center; justify-content: center;" title="Input Scores">
                🔢
                </button>
            </div>
            `;
        }

        let locationBadge = '';
        if (match.site || match.court) {
            const siteColor = getSiteColor(match.site);
            let courtText = '';
            if (match.court) {
                courtText = `(Court ${match.court})`;
            }
            locationBadge = `<div style="background: color-mix(in srgb, ${siteColor} 15%, transparent); color: ${siteColor}; font-size: 0.65rem; text-align: center; padding: 4px; border-top: 1px solid #334155; font-weight: bold; letter-spacing: 0.5px; margin-top: auto;">📍 ${match.site || ''} ${courtText}</div>`;
        }

        let feederLine = '';
        if (colIndex < visibleColumns.length - 1) { 
            const startColor = getSiteColor(match.site);
            let endColor = '#475569';
            
            const nextMatch = bracketData.find(n => n.t1 === `winner:${match.id}` || n.t2 === `winner:${match.id}`);
            if (nextMatch && nextMatch.site) {
                endColor = getSiteColor(nextMatch.site);
            }

            const lineWidth = '3';

            if (isStraight) {
                feederLine = `
                <div style="position: absolute; left: 100%; top: 50%; width: 80px; height: 100%; transform: translateY(-50%); z-index: 0; pointer-events: none;">
                    <svg width="100%" height="100%" style="overflow: visible;">
                        <defs>
                            <linearGradient id="grad_${canvasId}_${match.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="${startColor}" />
                                <stop offset="100%" stop-color="${endColor}" />
                            </linearGradient>
                        </defs>
                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="url(#grad_${canvasId}_${match.id})" stroke-width="${lineWidth}" vector-effect="non-scaling-stroke" />
                    </svg>
                </div>
                `;
            } else {
                const isTop = index % 2 === 0;
                const topCss = isTop ? 'top: 50%;' : 'bottom: 50%;';
                const d = isTop ? 'M 0,0 C 50,0 50,100 100,100' : 'M 0,100 C 50,100 50,0 100,0';

                feederLine = `
                <div style="position: absolute; left: 100%; ${topCss} width: 80px; height: 50%; z-index: 0; pointer-events: none;">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow: visible; position: absolute; top: 0; left: 0;">
                        <defs>
                            <linearGradient id="grad_${canvasId}_${match.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="${startColor}" />
                                <stop offset="100%" stop-color="${endColor}" />
                            </linearGradient>
                        </defs>
                        <path d="${d}" fill="none" stroke="url(#grad_${canvasId}_${match.id})" stroke-width="${lineWidth}" vector-effect="non-scaling-stroke" />
                    </svg>
                </div>
                `;
            }
        }

        const raw = savedScores[match.id] || {};
        let scoresText = [];
        if (raw.s1A != null && raw.s1B != null) scoresText.push(`${raw.s1A}-${raw.s1B}`);
        if (raw.s2A != null && raw.s2B != null) scoresText.push(`${raw.s2A}-${raw.s2B}`);
        if (raw.s3A != null && raw.s3B != null) scoresText.push(`${raw.s3A}-${raw.s3B}`);
        const scoresDisplay = scoresText.join(' <span style="color:#475569;">|</span> ');

        return `
        <div class="match-slot" style="display: flex; flex-direction: column; justify-content: center; position: relative; flex: 1; width: 100%; min-height: 90px; padding: 6px 0; box-sizing: border-box;">
            <div class="bracket-card">
                <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
                    <div class="bracket-header">
                        <span class="bracket-time" style="color: ${textAccent};">🕒 ${formatDisplayTime(match.time24)}</span>
                        <span class="bracket-id">Match ${match.id.replace(/[GS]/g, '')}</span>
                    </div>
                    <div class="bracket-teams-container">
                        <div class="bracket-team-row" style="${t1RowStyle}">
                            <div class="bracket-team-info" style="${t1Text}">
                                ${team1.name}
                            </div>
                            <span class="bracket-score" style="${t1Text}">${match.s1 !== null ? match.s1 : '-'}</span>
                        </div>
                        <div class="bracket-team-row" style="${t2RowStyle}">
                            <div class="bracket-team-info" style="${t2Text}">
                                ${team2.name}
                            </div>
                            <span class="bracket-score" style="${t2Text}">${match.s2 !== null ? match.s2 : '-'}</span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-size: 0.65rem; color: #64748b; background: rgba(0,0,0,0.15);">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <div>Ref: <span class="bracket-ref-team" style="color: ${textAccent};">${refTeam.name}</span></div>
                        </div>
                        <div style="text-align: right; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px;">
                            ${scoresDisplay}
                        </div>
                    </div>
                    ${locationBadge}
                </div>
                ${adminEditButton}
            </div>
            ${feederLine}
        </div>
        `;
    };

    let columnsHtml = '';
    
    visibleColumns.forEach((colName, colIndex) => {
        const colMatches = bracketData.filter(m => m.col === colName);
        if (colMatches.length > 0) {
            
            const nextColName = visibleColumns[colIndex + 1];
            const nextColMatches = nextColName ? bracketData.filter(m => m.col === nextColName) : [];
            const isStraight = nextColMatches.length === colMatches.length;

            let pairsHtml = '';
            if (isStraight) {
                colMatches.forEach((m) => {
                    pairsHtml += `
                    <div style="display: flex; flex-direction: column; justify-content: center; position: relative; flex-grow: 1;">
                        ${createMatchCard(m, 0, colIndex, true)}
                    </div>
                    `;
                });
            } else {
                for (let i = 0; i < colMatches.length; i += 2) {
                    const m1 = colMatches[i];
                    const m2 = colMatches[i+1];
                    
                    if (m2) {
                        pairsHtml += `
                        <div style="display: flex; flex-direction: column; justify-content: center; position: relative; flex-grow: 1;">
                            ${createMatchCard(m1, 0, colIndex, false)}
                            ${createMatchCard(m2, 1, colIndex, false)}
                        </div>
                        `;
                    } else {
                        pairsHtml += `
                        <div style="display: flex; flex-direction: column; justify-content: center; position: relative; flex-grow: 1;">
                            ${createMatchCard(m1, 0, colIndex, false)}
                        </div>
                        `;
                    }
                }
            }

            columnsHtml += `
            <div class="bracket-column">
                <div class="bracket-col-title">${colName}</div>
                <div class="bracket-matches">
                    ${pairsHtml}
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

    let scale = 1, translateX = 0, translateY = 0;
    let isDragging = false, startX, startY;
    let initialPinchDistance = null, initialScale = scale;

    const applyTransform = () => {
        surface.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    // --- DESKTOP MOUSE ZOOM (Scroll Wheel) ---
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

    // --- DESKTOP MOUSE PAN ---
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

    // --- MOBILE TOUCH PAN & PINCH-TO-ZOOM ---
    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            // Single finger = Pan
            isDragging = true;
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
            surface.style.transition = 'none';
        } else if (e.touches.length === 2) {
            // Two fingers = Pinch to Zoom
            isDragging = false; // Cancel pan when pinching
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialScale = scale;
            surface.style.transition = 'none';
        }
    }, { passive: false });

    viewport.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent the whole webpage from scrolling while swiping on the bracket
        
        if (e.touches.length === 1 && isDragging) {
            // Execute Pan
            translateX = e.touches[0].clientX - startX;
            translateY = e.touches[0].clientY - startY;
            applyTransform();
        } else if (e.touches.length === 2 && initialPinchDistance) {
            // Execute Pinch to Zoom
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            // Calculate new scale based on how far fingers moved
            const newScale = Math.min(Math.max(0.4, initialScale * (currentDistance / initialPinchDistance)), 2.0);
            
            // Find the midpoint between the two fingers to zoom directly into that spot
            const rect = viewport.getBoundingClientRect();
            const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
            const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

            translateX = midX - (midX - translateX) * (newScale / scale);
            translateY = midY - (midY - translateY) * (newScale / scale);
            scale = newScale;
            applyTransform();
        }
    }, { passive: false });

    viewport.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null; // Reset pinch if a finger is lifted
        }
        if (e.touches.length === 0) {
            stopDragging(); // Reset pan if all fingers are lifted
        }
    });
}

export function initBracketAdmin() {
    populateBracketAdminConfig();

    const saveConfigBtn = document.getElementById('saveBracketConfigBtn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
            const start = document.getElementById('bracketStartTime').value;
            const format = document.getElementById('bracketFormat')?.value || '1day';
            const seeding = document.getElementById('hasSeedingRounds')?.value || 'No';
            const divisions = document.getElementById('bracketDivisions')?.value || '2';
            
            const poolDuration = parseInt(document.getElementById('poolDuration').value, 10) || 60;
            const bracketDuration = parseInt(document.getElementById('bracketDuration').value, 10) || 60;

            const site1Name = document.getElementById('site1Name').value.trim();
            const site1Color = document.getElementById('site1Color').value;
            const site2Name = document.getElementById('site2Name').value.trim();
            const site2Color = document.getElementById('site2Color').value;
            const site3Name = document.getElementById('site3Name').value.trim();
            const site3Color = document.getElementById('site3Color').value;
            const bracketSets = document.getElementById('bracketSetsConfig')?.value || '1';

            const configObj = { 
                start, poolDuration, bracketDuration, format, seeding, divisions, bracketSets,
                site1Name, site1Color, site2Name, site2Color, site3Name, site3Color 
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
                saveConfigBtn.innerText = 'Save Defaults';
                saveConfigBtn.style.backgroundColor = 'var(--accent-orange)';
            }, 2000);
            
            renderBracketView();
        });
    }

    document.addEventListener('click', async (e) => {
        // --- 1. SCORES MODAL ---
        const scoreBtn = e.target.closest('.edit-bracket-score-btn');
        if (scoreBtn) {
            const matchId = scoreBtn.dataset.matchId;
            document.getElementById('bracketScoreMatchId').value = matchId;
            document.getElementById('bracketScoreModalMatchup').innerText = `${scoreBtn.dataset.t1} vs ${scoreBtn.dataset.t2}`;
            
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

        // --- 2. DETAILS MODAL ---
        const detailsBtn = e.target.closest('.edit-bracket-details-btn');
        if (detailsBtn) {
            const matchId = detailsBtn.dataset.matchId;
            
            document.getElementById('detailsMatchId').value = matchId;
            document.getElementById('bracketDetailsModalMatchup').innerText = `${detailsBtn.dataset.t1} vs ${detailsBtn.dataset.t2}`;
            
            const tourneyData = getTournamentData();
            const tourneyConfig = tourneyData?.bracket_config || {};
            const savedScores = tourneyData?.bracket_scores || {};
            const raw = savedScores[matchId] || {};
            
            document.getElementById('detailsTime').value = detailsBtn.dataset.time || '';
            document.getElementById('detailsCourt').value = raw.courtOverride || '';
            
            // Build Dynamic Site Dropdown
            const siteSelect = document.getElementById('detailsSite');
            
            let siteOpts = '<option value="">-- Select Site --</option>';
            
            [tourneyConfig.site1Name, tourneyConfig.site2Name, tourneyConfig.site3Name].forEach(s => {
                if (s) {
                    const isSiteSelected = raw.siteOverride === s ? 'selected' : '';
                    siteOpts += `<option value="${s}" ${isSiteSelected}>${s}</option>`;
                }
            });
            siteSelect.innerHTML = siteOpts;

            // Build dynamic Referee Dropdown
            const refSelect = document.getElementById('detailsRef');
            const teams = getTeams();
            const pools = getPools();
            const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
            
            let refOptions = '<option value="">-- Auto-Calculated Default --</option>';
            
            refOptions += '<optgroup label="Placeholder Seeds">';
            pools.forEach(pool => {
                for (let r = 1; r <= 4; r++) {
                    const seedVal = `seed:${pool.id}:${r}`;
                    const isSelected = raw.refOverride === seedVal ? 'selected' : '';
                    const rankStr = r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : '4th';
                    refOptions += `<option value="${seedVal}" ${isSelected}>${rankStr} ${pool.name}</option>`;
                }
            });
            refOptions += '</optgroup>';

            // Dynamically generate Loser options for ALL active divisions
            const activeDivisions = tourneyConfig.divisions || '2';
            const divisions = [
                { name: 'Gold', prefix: 'G' },
                { name: 'Silver', prefix: 'S' }
            ];
            if (activeDivisions === '3') divisions.push({ name: 'Bronze', prefix: 'B' });
            
            const hasSeeding = tourneyConfig.seeding === 'Yes' || tourneyData?.has_seeding_rounds === true;
            let loserMatchIds = ['1', '2', '3', '4', '5', '6', '7'];
            if (hasSeeding) loserMatchIds = ['S1', 'S2', 'S3', 'S4', ...loserMatchIds];

            divisions.forEach(div => {
                refOptions += `<optgroup label="${div.name} Division Losers">`;
                loserMatchIds.forEach(num => {
                    const refVal = `loser:${div.prefix}${num}`;
                    const isSelected = raw.refOverride === refVal ? 'selected' : '';
                    refOptions += `<option value="${refVal}" ${isSelected}>Loser of Match ${num} (${div.name})</option>`;
                });
                refOptions += `</optgroup>`;
            });

            refOptions += '<optgroup label="Specific Teams">';
            sortedTeams.forEach(t => {
                const isSelected = raw.refOverride === t.id ? 'selected' : '';
                refOptions += `<option value="${t.id}" ${isSelected}>${t.name}</option>`;
            });
            refOptions += '</optgroup>';
            
            refSelect.innerHTML = refOptions;
            
            document.getElementById('editBracketDetailsModal').style.display = 'flex';
        }

        // --- CLOSING MODALS ---
        if (e.target.closest('#closeBracketScoreModalBtn')) {
            document.getElementById('editBracketScoreModal').style.display = 'none';
        }
        if (e.target.closest('#closeBracketDetailsModalBtn')) {
            document.getElementById('editBracketDetailsModal').style.display = 'none';
        }

        // --- SAVING SCORES ---
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
            if (!savedScores[matchId]) savedScores[matchId] = {};
            
            savedScores[matchId] = { 
                ...savedScores[matchId], 
                s1A, s1B, s2A, s2B, s3A, s3B, setsA, setsB 
            };

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

        // --- SAVING DETAILS ---
        if (e.target.closest('#saveBracketDetailsBtn')) {
            const saveBtn = e.target.closest('#saveBracketDetailsBtn');
            const matchId = document.getElementById('detailsMatchId').value;
            const timeVal = document.getElementById('detailsTime').value;
            const siteVal = document.getElementById('detailsSite').value.trim();
            const courtVal = document.getElementById('detailsCourt').value.trim();
            const refVal = document.getElementById('detailsRef').value;
            
            let warningMsg = '';

            if (refVal) {
                const poolMatches = getMatches();
                const refConflictPool = poolMatches.find(m => m.time === timeVal && (m.teamA === refVal || m.teamB === refVal || m.ref === refVal));
                if (refConflictPool) {
                    warningMsg += '⚠️ The selected referee is already scheduled for a pool match at this time.\n';
                }
            }

            if (siteVal && courtVal) {
                const bracketMatches = window.activeBracketState || [];
                const courtConflict = bracketMatches.find(m => m.id !== matchId && m.time24 === timeVal && (m.site || '') === siteVal && (m.court || '') === courtVal);
                if (courtConflict) {
                    warningMsg += `⚠️ Court ${courtVal} at ${siteVal} is already booked for Bracket Match ${courtConflict.id.replace(/[A-Za-z]/g, '')} at this time.\n`;
                }
            }

            if (warningMsg) {
                warningMsg += '\nDo you still want to save these details?';
                if (!confirm(warningMsg)) return;
            }

            const originalText = saveBtn.innerText;
            saveBtn.innerText = 'Saving...';
            
            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const savedScores = tourneyData.bracket_scores || {};
            if (!savedScores[matchId]) savedScores[matchId] = {};
            
            if (timeVal) savedScores[matchId].timeOverride = timeVal; else delete savedScores[matchId].timeOverride;
            if (siteVal) savedScores[matchId].siteOverride = siteVal; else delete savedScores[matchId].siteOverride;
            if (courtVal) savedScores[matchId].courtOverride = courtVal; else delete savedScores[matchId].courtOverride;
            if (refVal) savedScores[matchId].refOverride = refVal; else delete savedScores[matchId].refOverride;

            const { error } = await supabase.from('tournaments').update({ bracket_scores: savedScores }).eq('id', tournamentId);
            
            if (error) {
                alert("Error saving details: " + error.message);
                saveBtn.innerText = originalText;
                return;
            }

            tourneyData.bracket_scores = savedScores;
            saveBtn.innerText = originalText;
            document.getElementById('editBracketDetailsModal').style.display = 'none';
            renderBracketView();
        }

        // --- CLEAR SCORES ---
        if (e.target.closest('#deleteBracketScoresBtn')) {
            if (!confirm("Clear scores for this bracket match? (This will not delete your Time/Location overrides).")) return;
            
            const tournamentId = getTournamentId();
            const tourneyData = getTournamentData();
            if (!tournamentId || !tourneyData) return;

            const matchId = document.getElementById('bracketScoreMatchId').value;
            const savedScores = tourneyData.bracket_scores || {};
            
            if (savedScores[matchId]) {
                delete savedScores[matchId].s1A;
                delete savedScores[matchId].s1B;
                delete savedScores[matchId].s2A;
                delete savedScores[matchId].s2B;
                delete savedScores[matchId].s3A;
                delete savedScores[matchId].s3B;
                delete savedScores[matchId].setsA;
                delete savedScores[matchId].setsB;
            }

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

        if (e.target.closest('#printBracketsBtn')) {
            printBrackets();
        }
    });
}

export function printBrackets() {
    const tournamentData = getTournamentData();
    const pools = getPools();
    const allTeams = typeof getTeams === 'function' ? getTeams() : [];
    const standingsByPool = typeof getAllPoolStandings === 'function' ? getAllPoolStandings() : {};
    
    let config = tournamentData?.bracket_config || {};
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch(e) {}
    }
    
    const bracketSets = parseInt(config.bracketSets || '1', 10);

    const addMinutesToTime = (timeStr, minsToAdd) => {
        if (!timeStr) return '13:00';
        let [h, m] = timeStr.split(':').map(Number);
        let date = new Date(2000, 0, 1, h, m + minsToAdd, 0);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const bDur = parseInt(config.bracketDuration || 60, 10);
    const configStart = config.start || '13:00';
    const t0 = addMinutesToTime(configStart, 0);
    const t1 = addMinutesToTime(configStart, bDur * 1);
    const t2 = addMinutesToTime(configStart, bDur * 2);

    const formatDisplayTime = (timeStr) => {
        if (!timeStr) return 'Time TBD';
        if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
        let [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h)) return timeStr;
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        m = m < 10 ? '0' + m : m;
        return `${h}:${m} ${ampm}`;
    };
    
    const getSiteColor = (siteName) => {
        if (!siteName) return '#475569'; 
        if (siteName === config.site1Name) return config.site1Color || '#3b82f6';
        if (siteName === config.site2Name) return config.site2Color || '#ef4444';
        if (siteName === config.site3Name) return config.site3Color || '#22c55e';
        return '#475569';
    };

    const printWin = window.open('', '_blank');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Brackets - ${tournamentData.name}</title>
        <style>
            @page { size: landscape; margin: 0.25in; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
            .page { page-break-after: always; display: flex; flex-direction: column; min-height: 95vh; box-sizing: border-box; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 2px solid #64748b; padding-bottom: 8px; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 900; text-transform: uppercase; color: #000; }
            .division-badge { padding: 4px 16px; font-size: 20px; font-weight: bold; border-radius: 6px; border: 2px solid #000; color: #000; text-transform: uppercase; letter-spacing: 1px; }
            
            .bracket-grid { display: flex; flex-grow: 1; gap: 15px; padding-bottom: 5px; height: 100%; justify-content: space-between; }
            .col { display: flex; flex-direction: column; flex: 1; min-width: 210px; position: relative; justify-content: space-around; }
            .round-title { text-align: center; font-size: 13px; font-weight: bold; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; letter-spacing: 1px; }
            
            .pair { flex: 1; display: flex; flex-direction: column; justify-content: space-around; position: relative; }
            
            .match-box { background: #fff; padding: 12px 8px 6px 8px; border: 2px solid #cbd5e1; border-radius: 8px; position: relative; z-index: 2; margin: 5px 0; }
            
            .time-badge { position: absolute; top: -9px; left: 12px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            .ref-badge { position: absolute; top: -9px; right: 12px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            
            .match-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
            
            .match-id-container { display: flex; flex-direction: row; align-items: baseline; gap: 4px; flex-wrap: wrap; }
            .match-id { font-weight: bold; font-size: 12px; color: #0f172a; white-space: nowrap; }
            
            .match-loc { font-size: 10px; font-weight: bold; text-transform: uppercase; }
            
            .team-slot { margin-bottom: 6px; }
            .team-slot:last-of-type { margin-bottom: 0px; }
            
            .team-line-container { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 2px; }
            
            .write-line { border-bottom: 2px solid #0f172a; height: 16px; flex-grow: 1; font-size: 14px; font-weight: bold; color: #000; padding: 2px 4px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: flex-end; box-sizing: border-box; }
            .winner-highlight { background-color: #cbd5e1 !important; border-top-left-radius: 4px; border-top-right-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .score-box { width: 26px; height: 24px; border: 2px solid #94a3b8; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: #0f172a; }
            
            .team-hint { font-size: 10px; color: #64748b; font-weight: bold; }
            
            .connector { position: absolute; right: -7px; top: 25%; bottom: 25%; width: 7px; border: 2px solid #94a3b8; border-left: none; border-radius: 0 8px 8px 0; z-index: 1; }
            .stem { position: absolute; right: -15px; top: 50%; width: 8px; border-top: 2px solid #94a3b8; z-index: 1; }

            .footer { text-align: center; font-size: 13px; font-style: italic; color: #64748b; margin-top: 5px; font-weight: 600; }
        </style>
    </head>
    <body>
    `;

    const pA = pools[0]?.id || 'poolA';
    const pB = pools[1]?.id || 'poolB';
    const pC = pools[2]?.id || 'poolC';
    const pD = pools[3]?.id || 'poolD';
    
    const pB_site = pools.find(p => p.id === pB)?.site || '';
    const pC_site = pools.find(p => p.id === pC)?.site || '';

    const divisions = ['Gold', 'Silver'];

    divisions.forEach(div => {
        let bracketData = [];
        
        if (div === 'Gold') {
            bracketData = [
                { col: 'Quarterfinals', rawTime: t0, id: 'G1', t1: `seed:${pA}:1`, t2: `seed:${pB}:2`, ref: `seed:${pA}:3` },
                { col: 'Quarterfinals', rawTime: t0, id: 'G2', t1: `seed:${pD}:1`, t2: `seed:${pC}:2`, ref: `seed:${pD}:3` },
                { col: 'Quarterfinals', rawTime: t0, id: 'G3', t1: `seed:${pC}:1`, t2: `seed:${pD}:2`, ref: `seed:${pC}:3` },
                { col: 'Quarterfinals', rawTime: t0, id: 'G4', t1: `seed:${pB}:1`, t2: `seed:${pA}:2`, ref: `seed:${pB}:3` },
                { col: 'Semifinals', rawTime: t1, id: 'G5', t1: `winner:G1`, t2: `winner:G2`, ref: `loser:G1` },
                { col: 'Semifinals', rawTime: t1, id: 'G6', t1: `winner:G3`, t2: `winner:G4`, ref: `loser:G4` },
                { col: 'Finals', rawTime: t2, id: 'G7', t1: `winner:G5`, t2: `winner:G6`, ref: `loser:G5` }
            ];
        } else if (div === 'Silver') {
            bracketData = [
                { col: 'Quarterfinals', rawTime: t0, id: 'S1', t1: `seed:${pA}:3`, t2: `seed:${pB}:4`, ref: `loser:G1` },
                { col: 'Quarterfinals', rawTime: t0, id: 'S_Bye1', t1: `seed:${pC}:3`, t2: `BYE`, isBye: true, feedsTo: 'S3', site: pC_site },
                { col: 'Quarterfinals', rawTime: t0, id: 'S2', t1: `seed:${pC}:4`, t2: `seed:${pD}:3`, ref: `loser:G3` },
                { col: 'Quarterfinals', rawTime: t0, id: 'S_Bye2', t1: `seed:${pB}:3`, t2: `BYE`, isBye: true, feedsTo: 'S4', site: pB_site },
                { col: 'Semifinals', rawTime: t1, id: 'S3', t1: `winner:S1`, t2: `seed:${pC}:3`, ref: `loser:S1` },
                { col: 'Semifinals', rawTime: t1, id: 'S4', t1: `winner:S2`, t2: `seed:${pB}:3`, ref: `loser:S2` },
                { col: 'Finals', rawTime: t2, id: 'S5', t1: `winner:S3`, t2: `winner:S4`, ref: `loser:S3` }
            ];
        }

        const savedScores = tournamentData?.bracket_scores || {};
        bracketData = bracketData.map(m => {
            const raw = savedScores[m.id] || {};
            return {
                ...m,
                raw: raw,
                site: raw.siteOverride || m.site || null,
                court: raw.courtOverride || null,
                refOverride: raw.refOverride || null,
                time: formatDisplayTime(raw.timeOverride || m.rawTime)
            };
        });

        const resolveTeam = (teamRef, matchSite) => {
            if (!teamRef) return { name: '', hint: '', travel: '', resolved: false };
            
            const foundTeam = allTeams.find(t => t.id === teamRef);
            if (foundTeam) return { name: foundTeam.name, hint: '', travel: '', resolved: true };

            if (typeof teamRef === 'string' && teamRef.startsWith('seed:')) {
                const parts = teamRef.split(':');
                const poolId = parts[1];
                const rankIndex = parseInt(parts[2]) - 1;
                const poolName = pools.find(p => p.id === poolId)?.name || 'Pool';
                const pSite = pools.find(p => p.id === poolId)?.site || '';
                const rankStr = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
                
                let travel = '';
                if (pSite && matchSite && pSite !== matchSite) {
                    travel = `<span style="color: ${getSiteColor(pSite)}; margin-left: 4px;">(from ${pSite})</span>`;
                }

                const poolStandings = standingsByPool[poolId] || [];
                let isLocked = false;
                
                if (poolStandings.length > 0 && poolStandings[rankIndex]) {
                    const expectedMatches = poolStandings.length === 3 ? 2 : 3;
                    const getPlayed = (t) => t.matchesPlayed !== undefined ? t.matchesPlayed : ((t.mw || 0) + (t.ml || 0));
                    const getWins = (t) => t.matchesWon !== undefined ? t.matchesWon : (t.mw || 0);
                    
                    const team = poolStandings[rankIndex];
                    const teamPlayed = getPlayed(team);
                    const teamWins = getWins(team);

                    if (teamPlayed >= expectedMatches) {
                        isLocked = true;
                        for (let i = 0; i < rankIndex; i++) {
                            const above = poolStandings[i];
                            if (getPlayed(above) < expectedMatches && getWins(above) <= teamWins) isLocked = false;
                        }
                        for (let i = rankIndex + 1; i < poolStandings.length; i++) {
                            const below = poolStandings[i];
                            const belowPlayed = getPlayed(below);
                            if (belowPlayed < expectedMatches && (getWins(below) + (expectedMatches - belowPlayed)) >= teamWins) isLocked = false;
                        }
                    }
                }
                
                if (isLocked) {
                    return { name: poolStandings[rankIndex].name, hint: `${rankStr} ${poolName}`, travel, resolved: true };
                }
                return { name: '', hint: `${rankStr} ${poolName}`, travel, resolved: false };
            }
            
            if (typeof teamRef === 'string' && (teamRef.startsWith('winner:') || teamRef.startsWith('loser:'))) {
                const [type, matchId] = teamRef.split(':');
                const targetPrefix = matchId.charAt(0);
                const targetNum = matchId.slice(1);
                const targetDivName = targetPrefix === 'G' ? 'Gold' : targetPrefix === 'S' ? 'Silver' : 'Bronze';
                const isCrossDivision = targetPrefix !== div.charAt(0);
                
                const typeStr = type === 'winner' ? 'Winner' : 'Loser';
                const hint = isCrossDivision 
                    ? `${typeStr} Match ${targetNum} (${targetDivName})`
                    : `${typeStr} Match ${targetNum}`;
                    
                const targetMatch = bracketData.find(m => m.id === matchId);
                let travel = '';
                if (targetMatch && targetMatch.site && matchSite && targetMatch.site !== matchSite) {
                    travel = `<span style="color: ${getSiteColor(targetMatch.site)}; margin-left: 4px;">(from ${targetMatch.site})</span>`;
                }

                if (targetMatch && targetMatch.raw) {
                    let aWins = 0, bWins = 0;
                    if (targetMatch.raw.s1A > targetMatch.raw.s1B) aWins++; else if (targetMatch.raw.s1B > targetMatch.raw.s1A) bWins++;
                    if (targetMatch.raw.s2A > targetMatch.raw.s2B) aWins++; else if (targetMatch.raw.s2B > targetMatch.raw.s2A) bWins++;
                    if (targetMatch.raw.s3A > targetMatch.raw.s3B) aWins++; else if (targetMatch.raw.s3B > targetMatch.raw.s3A) bWins++;
                    
                    if (aWins !== bWins && (aWins > 0 || bWins > 0)) {
                        const t1 = resolveTeam(targetMatch.t1, matchSite);
                        const t2 = resolveTeam(targetMatch.t2, matchSite);
                        if (t1.resolved && t2.resolved) {
                            const advancingTeam = type === 'winner' 
                                ? (aWins > bWins ? t1 : t2) 
                                : (aWins > bWins ? t2 : t1);
                            return { name: advancingTeam.name, hint: hint, travel, resolved: true };
                        }
                    }
                }
                return { name: '', hint: hint, travel, resolved: false };
            }
            return { name: '', hint: teamRef, travel: '', resolved: false };
        };

        const formatRef = (ref) => {
             if (!ref) return 'TBD';
             const foundRef = allTeams.find(t => t.id === ref);
             if (foundRef) return foundRef.name;
             
             if (ref.startsWith('loser:')) {
                 const matchId = ref.split(':')[1];
                 const num = matchId.replace(/^[GSB]/, '');
                 const divPrefix = matchId.charAt(0);
                 const divName = divPrefix === 'G' ? 'Gold' : divPrefix === 'S' ? 'Silver' : 'Bronze';
                 return `Loser M${num} (${divName})`;
             }
             if (ref.startsWith('seed:')) {
                 const parts = ref.split(':');
                 const rank = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
                 const pName = pools.find(p => p.id === parts[1])?.name || 'Pool';
                 return `${rank} ${pName}`;
             }
             if (typeof ref === 'string' && ref.toLowerCase().includes('loser')) {
                 if (!ref.includes('(')) {
                     const numMatch = ref.match(/\d+/);
                     const num = numMatch ? numMatch[0] : '';
                     let cleanedRef = ref.replace(/of\s+/i, ''); 
                     return num ? `Loser M${num} (${div})` : `${cleanedRef} (${div})`;
                 }
             }
             return ref;
        };
        
        const generateScoreBoxes = (matchRaw, teamLetter) => {
            let boxes = '';
            for (let i = 1; i <= bracketSets; i++) {
                let score = matchRaw[`s${i}${teamLetter}`];
                if (score == null || score === 'null' || score === '') {
                    score = '';
                    if (bracketSets === 3 && i === 3) {
                        const s1 = matchRaw[`s1${teamLetter}`];
                        const s2 = matchRaw[`s2${teamLetter}`];
                        if (s1 != null && s1 !== 'null' && s1 !== '' && 
                            s2 != null && s2 !== 'null' && s2 !== '') {
                            score = '-';
                        }
                    }
                }
                boxes += `<div class="score-box">${score}</div>`;
            }
            return boxes;
        };

        const renderByeBox = (m) => {
            if (!m) return '';
            const t1 = resolveTeam(m.t1, m.site);
            return `
            <div class="match-box" style="border: 2px dashed #94a3b8; background: #f8fafc; padding: 18px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 4px; letter-spacing: 1px;">AUTO-ADVANCE (BYE)</div>
                <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 4px;">${t1.name || t1.hint}</div>
                ${m.site ? `<div style="font-size: 10px; font-weight: bold; color: ${getSiteColor(m.site)};">Origin: ${m.site}</div>` : ''}
            </div>
            `;
        };

        const renderMatchBox = (m) => {
            if (!m) return '';
            const t1 = resolveTeam(m.t1, m.site);
            const t2 = resolveTeam(m.t2, m.site);
            const refStr = formatRef(m.refOverride || m.ref);
            
            let aWins = 0, bWins = 0;
            if (m.raw) {
                if (m.raw.s1A > m.raw.s1B) aWins++; else if (m.raw.s1B > m.raw.s1A) bWins++;
                if (m.raw.s2A > m.raw.s2B) aWins++; else if (m.raw.s2B > m.raw.s2A) bWins++;
                if (m.raw.s3A > m.raw.s3B) aWins++; else if (m.raw.s3B > m.raw.s3A) bWins++;
            }
            const t1Class = (aWins > bWins && aWins > 0) ? 'write-line winner-highlight' : 'write-line';
            const t2Class = (bWins > aWins && bWins > 0) ? 'write-line winner-highlight' : 'write-line';
            
            return `
            <div class="match-box">
                <div class="time-badge">${m.time}</div>
                <div class="ref-badge">Ref: ${refStr}</div>
                <div class="match-header">
                    <div class="match-id-container">
                        <span class="match-id">Match ${m.id.replace(/^[GSB]/, '')}</span>
                    </div>
                    <span class="match-loc" style="color: ${getSiteColor(m.site)};">${m.site || 'Site TBD'}</span>
                </div>
                <div class="team-slot">
                    <div class="team-line-container">
                        <div class="${t1Class}">${t1.name}</div>
                        ${generateScoreBoxes(m.raw, 'A')}
                    </div>
                    <div class="team-hint">${t1.hint} ${t1.travel}</div>
                </div>
                <div class="team-slot">
                    <div class="team-line-container">
                        <div class="${t2Class}">${t2.name}</div>
                        ${generateScoreBoxes(m.raw, 'B')}
                    </div>
                    <div class="team-hint">${t2.hint} ${t2.travel}</div>
                </div>
            </div>
            `;
        };

        html += `
        <div class="page">
            <div class="header">
                <h1>${tournamentData.name || 'Tournament Name'}</h1>
                <div class="division-badge">${div} Division</div>
            </div>
            <div class="bracket-grid">
        `;

        if (div === 'Gold') {
            html += `<div class="col">
                <div class="round-title">Quarterfinals</div>
                <div class="pair">
                    ${renderMatchBox(bracketData.find(m => m.id === 'G1'))}
                    ${renderMatchBox(bracketData.find(m => m.id === 'G2'))}
                    <div class="connector"></div><div class="stem"></div>
                </div>
                <div class="pair">
                    ${renderMatchBox(bracketData.find(m => m.id === 'G3'))}
                    ${renderMatchBox(bracketData.find(m => m.id === 'G4'))}
                    <div class="connector"></div><div class="stem"></div>
                </div>
            </div>
            <div class="col">
                <div class="round-title">Semifinals</div>
                <div class="pair">
                    ${renderMatchBox(bracketData.find(m => m.id === 'G5'))}
                    ${renderMatchBox(bracketData.find(m => m.id === 'G6'))}
                    <div class="connector"></div><div class="stem"></div>
                </div>
            </div>
            <div class="col">
                <div class="round-title">Championship</div>
                <div class="pair" style="justify-content: center;">
                    ${renderMatchBox(bracketData.find(m => m.id === 'G7'))}
                </div>
            </div>`;
        } else if (div === 'Silver') {
            html += `<div class="col">
                <div class="round-title">Quarterfinals</div>
                <div class="pair">
                    ${renderMatchBox(bracketData.find(m => m.id === 'S1'))}
                    ${renderByeBox(bracketData.find(m => m.id === 'S_Bye1'))}
                    <div class="connector"></div><div class="stem"></div>
                </div>
                <div class="pair">
                    ${renderMatchBox(bracketData.find(m => m.id === 'S2'))}
                    ${renderByeBox(bracketData.find(m => m.id === 'S_Bye2'))}
                    <div class="connector"></div><div class="stem"></div>
                </div>
            </div>
            <div class="col">
                <div class="round-title">Semifinals</div>
                <div class="pair">
                    ${renderMatchBox(bracketData.find(m => m.id === 'S3'))}
                    ${renderMatchBox(bracketData.find(m => m.id === 'S4'))}
                    <div class="connector"></div><div class="stem"></div>
                </div>
            </div>
            <div class="col">
                <div class="round-title">Championship</div>
                <div class="pair" style="justify-content: center;">
                    ${renderMatchBox(bracketData.find(m => m.id === 'S5'))}
                </div>
            </div>`;
        }

        html += `
            </div>
            <div class="footer">* Times are estimates. Matches start when courts clear.</div>
        </div>
        `;
    });

    html += `
    </body>
    </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    
    setTimeout(() => {
        printWin.focus();
        printWin.print();
    }, 250);
}