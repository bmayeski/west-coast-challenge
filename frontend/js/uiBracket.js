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

function renderCanvas(canvasId, selectId, isAdmin) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.style.padding = '0';
    canvas.style.overflow = 'hidden';
    canvas.style.border = 'none';

    const tourneyData = getTournamentData();
    const config = tourneyData?.bracket_config || { start: '13:00', bracketDuration: 60, poolDuration: 60, divisions: '2' };
    const savedScores = tourneyData?.bracket_scores || {}; 
    const hasSeeding = config.seeding === 'Yes' || tourneyData?.has_seeding_rounds === true;
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

    let r1 = 1, r2 = 2; 
    let prefix = 'G';   
    if (selectedDivision === 'silver') {
        r1 = 3; r2 = 4; prefix = 'S';   
    } else if (selectedDivision === 'bronze') {
        r1 = 5; r2 = 6; prefix = 'B';
    }

    const bDur = parseInt(config.bracketDuration || 60, 10);
    const tSeed1 = addMinutesToTime(config.start, bDur * 0);
    const tSeed2 = addMinutesToTime(config.start, bDur * 1);
    const tQf1   = addMinutesToTime(config.start, bDur * (hasSeeding ? 2 : 0));
    const tQf2   = addMinutesToTime(config.start, bDur * (hasSeeding ? 3 : 1));
    const tSf    = addMinutesToTime(config.start, bDur * (hasSeeding ? 4 : 2));
    const tFinal = addMinutesToTime(config.start, bDur * (hasSeeding ? 5 : 3));

    let bracketData = [];

    if (hasSeeding) {
        bracketData = [
            { col: 'Seeding Round', rawTime: tSeed1, id: `${prefix}S1`, t1: `seed:${pA}:${r1}`, t2: `seed:${pB}:${r1}`, ref: `seed:${pD}:${r1}` },
            { col: 'Seeding Round', rawTime: tSeed2, id: `${prefix}S2`, t1: `seed:${pC}:${r1}`, t2: `seed:${pD}:${r1}`, ref: `loser:${prefix}S1` },
            { col: 'Seeding Round', rawTime: tSeed2, id: `${prefix}S3`, t1: `seed:${pA}:${r2}`, t2: `seed:${pB}:${r2}`, ref: `loser:${prefix}S4` },
            { col: 'Seeding Round', rawTime: tSeed1, id: `${prefix}S4`, t1: `seed:${pC}:${r2}`, t2: `seed:${pD}:${r2}`, ref: `seed:${pB}:${r2}` },
            { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}1`, t1: `winner:${prefix}S1`, t2: `loser:${prefix}S4`, ref: `loser:${prefix}S2` },
            { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}2`, t1: `winner:${prefix}S3`, t2: `loser:${prefix}S2`, ref: `loser:${prefix}1` },
            { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}3`, t1: `winner:${prefix}S2`, t2: `loser:${prefix}S3`, ref: `loser:${prefix}4` },
            { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}4`, t1: `winner:${prefix}S4`, t2: `loser:${prefix}S1`, ref: `loser:${prefix}S3` },
            { col: 'Semifinals', rawTime: tSf, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2` },
            { col: 'Semifinals', rawTime: tSf, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3` },
            { col: 'Finals', rawTime: tFinal, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5` }
        ];
    } else {
        bracketData = [
            { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}1`, t1: `seed:${pA}:${r1}`, t2: `seed:${pB}:${r2}`, ref: `seed:${pC}:${r2}` },
            { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}2`, t1: `seed:${pD}:${r1}`, t2: `seed:${pC}:${r2}`, ref: `loser:${prefix}1` },
            { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}3`, t1: `seed:${pC}:${r1}`, t2: `seed:${pD}:${r2}`, ref: `loser:${prefix}4` },
            { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}4`, t1: `seed:${pB}:${r1}`, t2: `seed:${pA}:${r2}`, ref: `seed:${pD}:${r2}` },
            { col: 'Semifinals', rawTime: tSf, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2` },
            { col: 'Semifinals', rawTime: tSf, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3` },
            { col: 'Finals', rawTime: tFinal, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5` }
        ];
    }

    bracketData = bracketData.map(m => {
        const raw = savedScores[m.id] || {};
        return {
            ...m,
            time24: raw.timeOverride || m.rawTime,
            ref: raw.refOverride || m.ref,
            site: raw.siteOverride || null,
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
            
            const targetPrefix = matchId.charAt(0);
            const targetNum = matchId.slice(1);
            let targetDivName = targetPrefix === 'G' ? 'Gold' : targetPrefix === 'S' ? 'Silver' : 'Bronze';
            
            const typeStr = type === 'winner' ? 'Winner' : 'Loser';
            const isCrossDivision = targetPrefix !== prefix;
            const fallbackName = isCrossDivision 
                ? `${typeStr} Match ${targetNum} (${targetDivName})`
                : `${typeStr} Match ${targetNum}`;
            
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
            .bracket-viewport-class { width: 100%; height: 100%; min-height: 350px; background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; cursor: grab; user-select: none; }
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

    const visibleColumns = hasSeeding ? ['Seeding Round', 'Quarterfinals', 'Semifinals', 'Finals'] : ['Quarterfinals', 'Semifinals', 'Finals'];

    const createMatchCard = (match, index, colIndex, isStraight) => {
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

        const textAccent = match.site ? getSiteColor(match.site) : 'var(--accent-orange)';

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

            const configObj = { 
                start, poolDuration, bracketDuration, format, seeding, divisions,
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
    
    let config = tournamentData?.bracket_config || {};
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch(e) {}
    }
    
    const activeDivisions = parseInt(config.divisions || '2', 10);
    const hasSeeding = config.seeding === 'Yes' || tournamentData?.has_seeding_rounds === true;
    const bracketSets = parseInt(config.bracketSets || '1', 10);

    const addMinutesToTime = (timeStr, minsToAdd) => {
        if (!timeStr) return '13:00';
        let [h, m] = timeStr.split(':').map(Number);
        let date = new Date(2000, 0, 1, h, m + minsToAdd, 0);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const bDur = parseInt(config.bracketDuration || 60, 10);
    const configStart = config.start || '13:00';
    const tSeed1 = addMinutesToTime(configStart, bDur * 0);
    const tSeed2 = addMinutesToTime(configStart, bDur * 1);
    const tQf1   = addMinutesToTime(configStart, bDur * (hasSeeding ? 2 : 0));
    const tQf2   = addMinutesToTime(configStart, bDur * (hasSeeding ? 3 : 1));
    const tSf    = addMinutesToTime(configStart, bDur * (hasSeeding ? 4 : 2));
    const tFinal = addMinutesToTime(configStart, bDur * (hasSeeding ? 5 : 3));

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
            
            .bracket-grid { display: flex; flex-grow: 1; gap: 40px; padding-bottom: 5px; height: 100%; }
            .col { display: flex; flex-direction: column; flex: 1; position: relative; justify-content: space-around; }
            .round-title { text-align: center; font-size: 13px; font-weight: bold; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; letter-spacing: 1px; }
            
            .pair { flex: 1; display: flex; flex-direction: column; justify-content: space-around; position: relative; }
            
            .match-box { background: #fff; padding: 10px 12px 8px 12px; border: 2px solid #cbd5e1; border-radius: 8px; position: relative; z-index: 2; margin: 5px 0; mt-2; }
            
            .time-badge { position: absolute; top: -9px; left: 12px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            
            .match-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
            
            .match-id-container { display: flex; flex-direction: row; align-items: baseline; gap: 4px; flex-wrap: wrap; max-width: 70%; }
            .match-id { font-weight: bold; font-size: 14px; color: #0f172a; white-space: nowrap; }
            .match-ref { font-size: 11px; font-style: italic; color: #64748b; font-weight: normal; }
            
            .match-loc { font-size: 11px; font-weight: bold; text-transform: uppercase; }
            
            .team-slot { margin-bottom: 6px; }
            .team-slot:last-of-type { margin-bottom: 0px; }
            
            .team-line-container { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 2px; }
            .write-line { border-bottom: 2px solid #0f172a; height: 14px; flex-grow: 1; font-size: 14px; font-weight: bold; color: #000; padding-left: 2px; }
            .score-box { width: 30px; height: 26px; border: 2px solid #94a3b8; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: #0f172a; }
            
            .team-hint { font-size: 11px; color: #64748b; font-weight: bold; }
            
            .connector { position: absolute; right: -20px; top: 25%; bottom: 25%; width: 20px; border: 2px solid #94a3b8; border-left: none; border-radius: 0 8px 8px 0; z-index: 1; }
            .stem { position: absolute; right: -40px; top: 50%; width: 20px; border-top: 2px solid #94a3b8; z-index: 1; }

            .footer { text-align: center; font-size: 13px; font-style: italic; color: #64748b; margin-top: 5px; font-weight: 600; }
        </style>
    </head>
    <body>
    `;

    const pA = pools[0]?.id || 'poolA';
    const pB = pools[1]?.id || 'poolB';
    const pC = pools[2]?.id || 'poolC';
    const pD = pools[3]?.id || 'poolD';

    const divisions = ['Gold', 'Silver', 'Bronze'].slice(0, activeDivisions);

    divisions.forEach(div => {
        let prefix = div === 'Gold' ? 'G' : div === 'Silver' ? 'S' : 'B';
        let r1 = div === 'Gold' ? 1 : div === 'Silver' ? 3 : 5;
        let r2 = div === 'Gold' ? 2 : div === 'Silver' ? 4 : 6;
        
        let bracketData = [];
        if (hasSeeding) {
            bracketData = [
                { col: 'Seeding Round', rawTime: tSeed1, id: `${prefix}S1`, t1: `seed:${pA}:${r1}`, t2: `seed:${pB}:${r1}`, ref: `seed:${pD}:${r1}` },
                { col: 'Seeding Round', rawTime: tSeed2, id: `${prefix}S2`, t1: `seed:${pC}:${r1}`, t2: `seed:${pD}:${r1}`, ref: `loser:${prefix}S1` },
                { col: 'Seeding Round', rawTime: tSeed2, id: `${prefix}S3`, t1: `seed:${pA}:${r2}`, t2: `seed:${pB}:${r2}`, ref: `loser:${prefix}S4` },
                { col: 'Seeding Round', rawTime: tSeed1, id: `${prefix}S4`, t1: `seed:${pC}:${r2}`, t2: `seed:${pD}:${r2}`, ref: `seed:${pB}:${r2}` },
                { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}1`, t1: `winner:${prefix}S1`, t2: `loser:${prefix}S4`, ref: `loser:${prefix}S2` },
                { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}2`, t1: `winner:${prefix}S3`, t2: `loser:${prefix}S2`, ref: `loser:${prefix}1` },
                { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}3`, t1: `winner:${prefix}S2`, t2: `loser:${prefix}S3`, ref: `loser:${prefix}4` },
                { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}4`, t1: `winner:${prefix}S4`, t2: `loser:${prefix}S1`, ref: `loser:${prefix}S3` },
                { col: 'Semifinals', rawTime: tSf, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2` },
                { col: 'Semifinals', rawTime: tSf, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3` },
                { col: 'Finals', rawTime: tFinal, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5` }
            ];
        } else {
             bracketData = [
                { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}1`, t1: `seed:${pA}:${r1}`, t2: `seed:${pB}:${r2}`, ref: `seed:${pC}:${r2}` },
                { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}2`, t1: `seed:${pD}:${r1}`, t2: `seed:${pC}:${r2}`, ref: `loser:${prefix}1` },
                { col: 'Quarterfinals', rawTime: tQf2, id: `${prefix}3`, t1: `seed:${pC}:${r1}`, t2: `seed:${pD}:${r2}`, ref: `loser:${prefix}4` },
                { col: 'Quarterfinals', rawTime: tQf1, id: `${prefix}4`, t1: `seed:${pB}:${r1}`, t2: `seed:${pA}:${r2}`, ref: `seed:${pD}:${r2}` },
                { col: 'Semifinals', rawTime: tSf, id: `${prefix}5`, t1: `winner:${prefix}1`, t2: `winner:${prefix}2`, ref: `loser:${prefix}2` },
                { col: 'Semifinals', rawTime: tSf, id: `${prefix}6`, t1: `winner:${prefix}3`, t2: `winner:${prefix}4`, ref: `loser:${prefix}3` },
                { col: 'Finals', rawTime: tFinal, id: `${prefix}7`, t1: `winner:${prefix}5`, t2: `winner:${prefix}6`, ref: `loser:${prefix}5` }
            ];
        }

        const savedScores = tournamentData?.bracket_scores || {};
        bracketData = bracketData.map(m => {
            const raw = savedScores[m.id] || {};
            return {
                ...m,
                raw: raw, // Passing raw data to extract scores later
                site: raw.siteOverride || null,
                court: raw.courtOverride || null,
                refOverride: raw.refOverride || null,
                time: formatDisplayTime(raw.timeOverride || m.rawTime)
            };
        });

        const formatTeam = (ref, matchSite) => {
            if (!ref) return { text: '', travel: '', name: '' };
            
            // Check if actual team name exists in database
            const foundTeam = allTeams.find(t => t.id === ref);
            const actualName = foundTeam ? foundTeam.name : '';

            if (ref.startsWith('seed:')) {
                const parts = ref.split(':');
                const rank = parts[2] == 1 ? '1st' : parts[2] == 2 ? '2nd' : parts[2] == 3 ? '3rd' : '4th';
                const pName = pools.find(p => p.id === parts[1])?.name || 'Pool';
                const pSite = pools.find(p => p.id === parts[1])?.site || '';
                let travel = '';
                if (pSite && matchSite && pSite !== matchSite) {
                    travel = `<span style="color: ${getSiteColor(pSite)}; font-weight: bold; margin-left: 4px;">(from ${pSite})</span>`;
                }
                return { text: `${rank} ${pName}`, travel, name: actualName };
            }
            if (ref.startsWith('winner:')) {
                const srcMatch = bracketData.find(m => m.id === ref.split(':')[1]);
                let travel = '';
                if (srcMatch && srcMatch.site && matchSite && srcMatch.site !== matchSite) {
                    travel = `<span style="color: ${getSiteColor(srcMatch.site)}; font-weight: bold; margin-left: 4px;">(from ${srcMatch.site})</span>`;
                }
                return { text: `Winner Match ${ref.split(':')[1].replace(/^[GSB]/, '')}`, travel, name: actualName };
            }
            if (ref.startsWith('loser:')) return { text: `Loser Match ${ref.split(':')[1].replace(/^[GSB]/, '')}`, travel: '', name: actualName };
            
            return { text: ref, travel: '', name: actualName };
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
        
        // Helper to generate populated score boxes for a specific team (A or B)
        const generateScoreBoxes = (matchRaw, teamLetter) => {
            let boxes = '';
            for (let i = 1; i <= bracketSets; i++) {
                const score = matchRaw[`s${i}${teamLetter}`];
                boxes += `<div class="score-box">${score !== undefined ? score : ''}</div>`;
            }
            return boxes;
        };

        const renderMatchBox = (m) => {
            if (!m) return '';
            const t1 = formatTeam(m.t1, m.site);
            const t2 = formatTeam(m.t2, m.site);
            const refStr = formatRef(m.refOverride || m.ref);
            
            return `
            <div class="match-box">
                <div class="time-badge">${m.time}</div>
                <div class="match-header">
                    <div class="match-id-container">
                        <span class="match-id">Match ${m.id.replace(/^[GSB]/, '')}</span>
                        <span class="match-ref">(Ref: ${refStr})</span>
                    </div>
                    <span class="match-loc" style="color: ${getSiteColor(m.site)};">${m.site || 'Site TBD'}</span>
                </div>
                
                <div class="team-slot">
                    <div class="team-line-container">
                        <div class="write-line">${t1.name}</div>
                        ${generateScoreBoxes(m.raw, 'A')}
                    </div>
                    <div class="team-hint">${t1.text} ${t1.travel}</div>
                </div>
                
                <div class="team-slot">
                    <div class="team-line-container">
                        <div class="write-line">${t2.name}</div>
                        ${generateScoreBoxes(m.raw, 'B')}
                    </div>
                    <div class="team-hint">${t2.text} ${t2.travel}</div>
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

        const getRound = (col) => bracketData.filter(m => m.col === col);

        if (hasSeeding) {
            const sMatches = getRound('Seeding Round');
            html += `<div class="col">
               <div class="round-title">Seeding Round</div>
               ${sMatches.map(m => `
                   <div class="pair" style="justify-content: center;">
                       ${renderMatchBox(m)}
                   </div>
               `).join('')}
            </div>`;
        }

        const qf = getRound('Quarterfinals');
        html += `<div class="col">
            <div class="round-title">Quarterfinals</div>
            <div class="pair">
                ${renderMatchBox(qf[0])}
                ${renderMatchBox(qf[1])}
                <div class="connector"></div><div class="stem"></div>
            </div>
            <div class="pair">
                ${renderMatchBox(qf[2])}
                ${renderMatchBox(qf[3])}
                <div class="connector"></div><div class="stem"></div>
            </div>
        </div>`;

        const sf = getRound('Semifinals');
        html += `<div class="col">
            <div class="round-title">Semifinals</div>
            <div class="pair">
                ${renderMatchBox(sf[0])}
                ${renderMatchBox(sf[1])}
                <div class="connector"></div><div class="stem"></div>
            </div>
        </div>`;

        const f = getRound('Finals');
        html += `<div class="col">
            <div class="round-title">Championship</div>
            <div class="pair" style="justify-content: center;">
                ${renderMatchBox(f[0])}
            </div>
        </div>`;

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