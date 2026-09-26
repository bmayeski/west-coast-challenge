// adminManagePools.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, getTeams, getPools, getMatches, setMatches, getTournamentData } from './state.js';
import { getAllPoolStandings } from './uiMath.js';
import { formatTime, getSiteColor, ensureReadableColor } from './utils.js';
import { renderPublicPools } from './uiPublic.js';

export function initManagePools() {
    const refreshBtn = document.getElementById('refreshScoresBtn');
    const closeBtn = document.getElementById('closeScoreModalBtn');
    const saveBtn = document.getElementById('saveScoresBtn');

    if (refreshBtn) refreshBtn.addEventListener('click', loadPoolScores);
    if (closeBtn) closeBtn.addEventListener('click', closeScoreModal);
    if (saveBtn) saveBtn.addEventListener('click', handleSaveScores);

    // Consolidated Event Delegation for the entire Manage Pools view
    document.addEventListener('click', (e) => {
        // 1. Open Score Modal
        if (e.target.classList.contains('edit-score-admin-btn')) {
            openScoreModal(e.target.dataset.matchId);
        }
        
        // 2. Open Pool Details Modal (The new ⚙️ button)
        if (e.target.closest('.edit-pool-details-btn')) {
            const btn = e.target.closest('.edit-pool-details-btn');
            document.getElementById('poolDetailsMatchId').value = btn.dataset.matchId;
            document.getElementById('poolDetailsModalMatchup').innerText = `${btn.dataset.t1} vs ${btn.dataset.t2}`;
            
            document.getElementById('poolDetailsTime').value = btn.dataset.time || '';
            
            const allTeams = getTeams();
            const sortedTeams = [...allTeams].sort((a, b) => a.name.localeCompare(b.name));
            
            let refOpts = '<option value="">-- Select Referee --</option>';
            sortedTeams.forEach(t => {
                const isSelected = btn.dataset.ref === t.id ? 'selected' : '';
                refOpts += `<option value="${t.id}" ${isSelected}>${t.name}</option>`;
            });
            document.getElementById('poolDetailsRef').innerHTML = refOpts;
            
            const modal = document.getElementById('editPoolDetailsModal');
            if (modal) modal.style.display = 'flex';
        }

        // 3. Close Pool Details Modal
        if (e.target.closest('#closePoolDetailsModalBtn')) {
            const modal = document.getElementById('editPoolDetailsModal');
            if (modal) modal.style.display = 'none';
        }

        // 4. Save Pool Details
        if (e.target.closest('#savePoolDetailsBtn')) {
            handleSavePoolDetails(e.target.closest('#savePoolDetailsBtn'));
        }

        // 5. Print Pool Sheets
        if (e.target.id === 'printPoolSheetsBtn') {
            printPoolSheets();
        }
    });
}

export async function loadPoolScores() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('time', { ascending: true }); 

    if (error) {
        console.error("Error loading matches:", error);
        return;
    }

    if (matches) {
        setMatches(matches);
        renderAdminPools();
        
        if (typeof renderPublicPools === 'function') {
            renderPublicPools();
        }
    }
}

function getOrdinalSuffix(i) {
    const j = i % 10, k = i % 100;
    if (j == 1 && k != 11) return i + "st";
    if (j == 2 && k != 12) return i + "nd";
    if (j == 3 && k != 13) return i + "rd";
    return i + "th";
}

export function renderAdminPools() {
    const container = document.getElementById('adminScoresGrid');
    if (!container) return;

    const standingsByPool = getAllPoolStandings();
    const pools = getPools();
    const allMatches = getMatches();
    const allTeams = getTeams();
    
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    if (pools.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No pools have been created yet.</p>';
        return;
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 15px; width: 100%;">';
    
    pools.forEach(pool => {
        const standings = standingsByPool[pool.id] || [];
        const poolMatches = allMatches
            .filter(m => m.pool_id === pool.id && !(typeof m.teamA === 'string' && m.teamA.startsWith('seed:')))
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const headerColor = getSiteColor(pool.site);
        
        const isPoolComplete = poolMatches.length > 0 && poolMatches.every(m => m.status === 'completed' || m.status === 'complete');
        const maxMatches = standings.length > 0 ? standings.length - 1 : 0; 
        
        const nextMatchIndex = poolMatches.findIndex(m => m.status !== 'completed' && m.status !== 'complete');

        html += `
        <div style="background: var(--surface-dark); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); display: flex; flex-direction: column;">
            
            <div style="background: ${headerColor}; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                <span style="font-size: 1rem; display: flex; align-items: center; gap: 8px;">🏐 ${pool.name}</span>
                <span style="font-size: 0.8rem; font-weight: 500; opacity: 0.9;">${pool.site || ''}</span>
            </div>
            
            <div style="padding: 12px; flex-grow: 1; display: flex; flex-direction: column;">
                
                <table style="width: 100%; text-align: center; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 15px; table-layout: fixed;">
                    <colgroup>
                        <col style="width: 38px;">
                        <col style="width: auto;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 28px;"> 
                        <col style="width: 32px;"> 
                        <col style="width: 32px;"> 
                    </colgroup>
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                            <th rowspan="2" style="padding: 4px; text-align: center;">Seed</th>
                            <th rowspan="2" style="padding: 4px 0 4px 8px; text-align: left;">Team</th>
                            <th colspan="2" style="padding: 4px; border-left: 1px solid var(--border-color); color: #fff; font-size: 0.7rem;">Matches</th>
                            <th colspan="2" style="padding: 4px; border-left: 1px solid var(--border-color); color: #fff; font-size: 0.7rem;">Sets</th>
                            <th rowspan="2" style="padding: 4px; border-left: 1px solid var(--border-color); line-height: 1.2;">Set<br>+/-</th>
                            <th rowspan="2" style="padding: 4px; border-left: 1px solid var(--border-color); line-height: 1.2;">Pt<br>+/-</th>
                        </tr>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--accent-orange); font-weight: bold; font-size: 0.7rem;">
                            <th style="padding: 2px; border-left: 1px solid var(--border-color);">W</th>
                            <th style="padding: 2px;">L</th>
                            <th style="padding: 2px; border-left: 1px solid var(--border-color);">W</th>
                            <th style="padding: 2px;">L</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standings.map((team, index) => {
                            let seedDisplay = '';
                            
                            let isMathematicallyLocked = false;
                            if (team.matchesPlayed === maxMatches && maxMatches > 0) {
                                let safeFromAbove = true;
                                let safeFromBelow = true;

                                for (let i = 0; i < index; i++) {
                                    if (standings[i].matchesPlayed < maxMatches && standings[i].matchesWon <= team.matchesWon) {
                                        safeFromAbove = false;
                                    }
                                }
                                for (let i = index + 1; i < standings.length; i++) {
                                    const maxPossibleWins = standings[i].matchesWon + (maxMatches - standings[i].matchesPlayed);
                                    if (standings[i].matchesPlayed < maxMatches && maxPossibleWins >= team.matchesWon) {
                                        safeFromBelow = false;
                                    }
                                }
                                isMathematicallyLocked = safeFromAbove && safeFromBelow;
                            }
                            
                            if (isPoolComplete || isMathematicallyLocked) {
                                const placeStr = getOrdinalSuffix(index + 1);
                                let badgeBg = 'rgba(255,255,255,0.1)';
                                let badgeText = 'var(--text-secondary)';
                                
                                if (index === 0) { badgeBg = '#fbbf24'; badgeText = '#1e293b'; } 
                                else if (index === 1) { badgeBg = '#94a3b8'; badgeText = '#1e293b'; } 
                                else if (index === 2) { badgeBg = '#b45309'; badgeText = '#ffffff'; } 
                                
                                seedDisplay = `<span style="background: ${badgeBg}; padding: 2px 6px; border-radius: 12px; color: ${badgeText}; font-weight: bold; font-size: 0.65rem; display: inline-block; min-width: 24px;">${placeStr}</span>`;
                            } else {
                                seedDisplay = `<span style="color: var(--text-secondary); font-size: 0.8rem;">${team.seed === 99 ? '-' : team.seed}</span>`;
                            }

                            const logoHtml = team.logo_id ? `<img src="${team.logo_id}" style="width: 24px; height: 24px; object-fit: contain; flex-shrink: 0;">` : `<div style="width: 20px; height: 20px; sbackground: ${team.color || '#3b82f6'}; flex-shrink: 0;"></div>`;
                            const nameColor = team.color ? ensureReadableColor(team.color) : 'var(--text-primary)';
                            
                            const setSign = team.setDiff > 0 ? '+' : '';
                            const ptSign = team.pointDiff > 0 ? '+' : '';

                            const rowHtml = `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 8px 2px; text-align: center;">${seedDisplay}</td>
                                <td style="padding: 8px 0 8px 8px; text-align: left; font-weight: bold; overflow: hidden;">
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                        ${logoHtml}
                                        <span style="color: ${nameColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: inline-block; vertical-align: middle;">
                                            ${team.name}
                                        </span>
                                    </div>
                                </td>
                                <td style="padding: 8px 2px; font-weight: bold; border-left: 1px solid var(--border-color); color: white;">${team.matchesWon}</td>
                                <td style="padding: 8px 2px; font-weight: bold; color: white;">${team.matchesLost}</td>
                                <td style="padding: 8px 2px; border-left: 1px solid var(--border-color); color: white;">${team.setsWon}</td>
                                <td style="padding: 8px 2px; color: white;">${team.setsLost}</td>
                                <td style="padding: 8px 2px; border-left: 1px solid var(--border-color); color: ${team.setDiff >= 0 ? '#22c55e' : '#ef4444'};">${setSign}${team.setDiff}</td>
                                <td style="padding: 8px 2px; border-left: 1px solid var(--border-color); color: ${team.pointDiff >= 0 ? '#22c55e' : '#ef4444'}; font-weight: bold;">${ptSign}${team.pointDiff}</td>
                            </tr>
                            `;

                            return {
                                seed: team.seed,
                                name: team.name,
                                html: rowHtml
                            };
                        }).sort((a, b) => {
                            if (a.seed !== b.seed) return a.seed - b.seed;
                            return a.name.localeCompare(b.name);
                        }).map(item => item.html).join('')}
                    </tbody>
                </table>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${poolMatches.map((m, index) => {
                        const t1 = teamMap.get(m.teamA);
                        const t2 = teamMap.get(m.teamB);
                        const ref = teamMap.get(m.ref);
                        
                        const t1Name = t1 ? t1.name : 'TBD';
                        const t2Name = t2 ? t2.name : 'TBD';
                        const refName = ref ? ref.name : 'TBD';
                        
                        const isComplete = (m.status === 'completed' || m.status === 'complete');
                        const isNextMatch = (index === nextMatchIndex);
                        
                        const s1a = m.s1A !== null && m.s1A !== undefined ? m.s1A : '-';
                        const s1b = m.s1B !== null && m.s1B !== undefined ? m.s1B : '-';
                        const s2a = m.s2A !== null && m.s2A !== undefined ? m.s2A : '-';
                        const s2b = m.s2B !== null && m.s2B !== undefined ? m.s2B : '-';
                        const s3a = m.s3A !== null && m.s3A !== undefined ? m.s3A : '-';
                        const s3b = m.s3B !== null && m.s3B !== undefined ? m.s3B : '-';

                        const hasScores = (s1a !== '-' || s1b !== '-' || s2a !== '-' || s2b !== '-' || s3a !== '-' || s3b !== '-');

                        let t1Sets = 0;
                        let t2Sets = 0;
                        if (s1a !== '-' && s1b !== '-') { if (Number(s1a) > Number(s1b)) t1Sets++; else if (Number(s1b) > Number(s1a)) t2Sets++; }
                        if (s2a !== '-' && s2b !== '-') { if (Number(s2a) > Number(s2b)) t1Sets++; else if (Number(s2b) > Number(s2a)) t2Sets++; }
                        if (s3a !== '-' && s3b !== '-') { if (Number(s3a) > Number(s3b)) t1Sets++; else if (Number(s3b) > Number(s3a)) t2Sets++; }
                        
                        const t1Winner = isComplete && t1Sets > t2Sets;
                        const t2Winner = isComplete && t2Sets > t1Sets;

                        const t1Style = t1Winner ? 'color: #fff; font-weight: 700;' : 'color: var(--text-secondary); font-weight: normal;';
                        const t2Style = t2Winner ? 'color: #fff; font-weight: 700;' : 'color: var(--text-secondary); font-weight: normal;';

                        let statusBadge = '';
                        if (isComplete) {
                            statusBadge = `<span title="Completed" style="color: #22c55e; font-weight: 900; font-size: 0.8rem;">✔</span>`;
                        } else if (hasScores || isNextMatch) {
                            statusBadge = `<span title="In Progress" style="color: var(--accent-orange); font-weight: 900; font-size: 0.75rem;">▶</span>`;
                        } else {
                            statusBadge = `<span title="Scheduled" style="color: #64748b; font-weight: 900; font-size: 0.9rem;">-</span>`;
                        }

                        return `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                            <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0; padding-right: 10px;">
                                <div style="font-size: 0.9rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    <span style="${t1Style}">${t1Name}</span> <span style="color: var(--text-secondary); font-size: 0.75rem; font-weight: normal; margin: 0 5px;">vs</span> <span style="${t2Style}">${t2Name}</span>
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                                    <span style="color: var(--accent-orange); font-weight: bold; flex-shrink: 0;">${formatTime(m.time)}</span>
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1;">Ref: ${refName}</span>
                                    <div style="width: 20px; text-align: right; flex-shrink: 0;">${statusBadge}</div>
                                </div>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; min-width: 110px;">
                                <div style="display: flex; gap: 6px; text-align: center; font-size: 0.75rem; color: var(--text-secondary); justify-content: flex-end; width: 100%;">
                                    <div style="width: 34px; background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 0;">${s1a}-${s1b}</div>
                                    <div style="width: 34px; background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 0;">${s2a}-${s2b}</div>
                                    <div style="width: 34px; background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 0;">${s3a}-${s3b}</div>
                                </div>
                                <div style="display: flex; gap: 4px; width: 100%;">
                                    <button class="btn edit-pool-details-btn" 
                                        data-match-id="${m.id}" 
                                        data-t1="${t1Name}" 
                                        data-t2="${t2Name}" 
                                        data-time="${m.time ? m.time : ''}" 
                                        data-court="${m.court ? m.court : ''}" 
                                        data-ref="${m.ref ? m.ref : ''}" 
                                        style="font-size: 0.9rem; padding: 3px 8px; background: var(--surface-light); border: 1px solid var(--border-color); color: white; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center;" title="Edit Match Details">⚙️</button>
                                    <button class="btn edit-score-admin-btn" data-match-id="${m.id}" style="font-size: 0.65rem; padding: 3px; background: var(--surface-light); border: 1px solid var(--border-color); color: white; cursor: pointer; border-radius: 4px; flex-grow: 1;">Edit Scores</button>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function openScoreModal(matchId) {
    const matches = getMatches();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const allTeams = getTeams();
    const t1 = allTeams.find(t => t.id === match.teamA);
    const t2 = allTeams.find(t => t.id === match.teamB);

    document.getElementById('scoreModalMatchId').value = match.id;
    document.getElementById('scoreModalMatchup').textContent = `${t1 ? t1.name : 'Team A'} vs ${t2 ? t2.name : 'Team B'}`;
    
    document.getElementById('s1A').value = match.s1A ?? '';
    document.getElementById('s1B').value = match.s1B ?? '';
    document.getElementById('s2A').value = match.s2A ?? '';
    document.getElementById('s2B').value = match.s2B ?? '';
    document.getElementById('s3A').value = match.s3A ?? '';
    document.getElementById('s3B').value = match.s3B ?? '';

    document.getElementById('matchCompleteCheckbox').checked = (match.status === 'completed' || match.status === 'complete');

    document.getElementById('editScoreModal').style.display = 'flex';
}

function closeScoreModal() {
    document.getElementById('editScoreModal').style.display = 'none';
}

async function handleSaveScores() {
    const matchId = document.getElementById('scoreModalMatchId').value;
    if (!matchId) return;

    const s1A = document.getElementById('s1A').value;
    const s1B = document.getElementById('s1B').value;
    const s2A = document.getElementById('s2A').value;
    const s2B = document.getElementById('s2B').value;
    const s3A = document.getElementById('s3A').value;
    const s3B = document.getElementById('s3B').value;
    const isComplete = document.getElementById('matchCompleteCheckbox').checked;

    const updateData = {
        s1A: s1A !== '' ? parseInt(s1A) : null,
        s1B: s1B !== '' ? parseInt(s1B) : null,
        s2A: s2A !== '' ? parseInt(s2A) : null,
        s2B: s2B !== '' ? parseInt(s2B) : null,
        s3A: s3A !== '' ? parseInt(s3A) : null,
        s3B: s3B !== '' ? parseInt(s3B) : null,
        status: isComplete ? 'completed' : 'scheduled'
    };

    const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

    if (error) {
        alert("Error saving scores: " + error.message);
    } else {
        closeScoreModal();
        loadPoolScores(); 
    }
}

async function handleSavePoolDetails(btn) {
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    
    const matchId = document.getElementById('poolDetailsMatchId').value;
    const time = document.getElementById('poolDetailsTime').value;
    const ref = document.getElementById('poolDetailsRef').value;
    
    // Send only the time and ref to Supabase to prevent the column error
    const { error } = await supabase
        .from('matches')
        .update({ time, ref })
        .eq('id', matchId);
        
    if (error) {
        alert("Error saving details: " + error.message);
    } else {
        const allMatches = getMatches();
        const m = allMatches.find(m => m.id === matchId);
        if (m) {
            m.time = time;
            m.ref = ref;
        }
        document.getElementById('editPoolDetailsModal').style.display = 'none';
        renderAdminPools();
    }
    btn.innerText = originalText;
}

export function printPoolSheets() {
    const tournamentData = getTournamentData();
    const pools = getPools();
    const allTeams = getTeams();
    const allMatches = getMatches(); 
    
    if (!pools || pools.length === 0) {
        alert("No pools have been created yet.");
        return;
    }

    let config = tournamentData?.bracket_config || {};
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch(e) {}
    }
    
    const poolStart = config.poolStartTime || tournamentData?.start_time || '08:00';
    const poolDur = parseInt(config.poolDuration || '60', 10);

    const addMins = (timeStr, minsToAdd) => {
        if (!timeStr) return '08:00';
        let [h, m] = timeStr.split(':').map(Number);
        let date = new Date(2000, 0, 1, h, m + minsToAdd, 0);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

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

    const toRoman = (num) => {
        if (!num || num === 0) return '';
        const roman = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        return roman[num] || num;
    };
    
    const getOrdinal = (n) => {
        if (n === 1) return '1st';
        if (n === 2) return '2nd';
        if (n === 3) return '3rd';
        if (n === 4) return '4th';
        return n + 'th';
    };
    
    const getSiteColor = (siteName) => {
        if (!siteName) return '#475569'; 
        if (siteName === config.site1Name) return config.site1Color || '#3b82f6';
        if (siteName === config.site2Name) return config.site2Color || '#ef4444';
        if (siteName === config.site3Name) return config.site3Color || '#22c55e';
        return '#475569';
    };

    // --- NEW: Helper to translate "seed:poolC:3" into "3rd C" on paper ---
    const formatSeedPrint = (refStr) => {
        if (!refStr) return '?';
        if (typeof refStr === 'string' && refStr.startsWith('seed:')) {
            const parts = refStr.split(':');
            const poolObj = pools.find(p => p.id === parts[1]);
            const pName = poolObj ? poolObj.name.replace('Pool ', '') : '';
            const r = parseInt(parts[2], 10);
            const rStr = r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : r === 4 ? '4th' : r;
            return `${rStr} ${pName}`;
        }
        
        // Fallback for real teams reffing out of their own pool
        const realTeam = allTeams.find(t => t.id === refStr);
        if (realTeam) return realTeam.seed || '?';

        return '?';
    };

    const printWin = window.open('', '_blank');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Pool Sheets - ${tournamentData.name}</title>
        <style>
            @page { size: landscape; margin: 0.25in; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
            .page { page-break-after: always; display: flex; flex-direction: column; min-height: 95vh; box-sizing: border-box; }
            .page:last-child { page-break-after: auto; }
            
            /* REDUCED: Header margins */
            .header { margin-bottom: 8px; border-bottom: 2px solid #64748b; padding-bottom: 6px; text-align: center; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 900; text-transform: uppercase; color: #000; }
            
            /* REDUCED: Table margins and cell padding */
            table.standings-table { width: 80%; margin: 0 auto 15px auto; border-collapse: separate; border-spacing: 0; border: 2px solid #64748b; border-radius: 8px; }
            table.standings-table th, table.standings-table td { border-right: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; padding: 5px 10px; text-align: center; font-size: 15px; }
            table.standings-table th:last-child, table.standings-table td:last-child { border-right: none; }
            table.standings-table tr:last-child td { border-bottom: none; }
            
            table.standings-table th { text-transform: uppercase; font-weight: bold; background-color: transparent; color: #334155; }
            table.standings-table td.team-name { text-align: left; font-weight: bold; width: 40%; font-size: 17px; color: #0f172a; }
            table.standings-table td.team-rank { font-weight: 900; color: #475569; width: 30px; font-size: 17px; }
            
            .placement-badge { display: inline-block; width: 36px; text-align: center; padding: 2px 0; border-radius: 4px; font-size: 13px; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .badge-1st { background-color: #fbbf24 !important; color: #000 !important; }
            .badge-2nd { background-color: #cbd5e1 !important; color: #000 !important; }
            .badge-3rd { background-color: #cd7f32 !important; color: #fff !important; }
            .badge-4th { background-color: #475569 !important; color: #fff !important; }
            .badge-other { background-color: #0f172a !important; color: #fff !important; }
            
            .pool-info-cell { vertical-align: middle; border-top-left-radius: 8px; }
            .location-name { font-size: 13px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
            .pool-badge { display: inline-block; padding: 3px 14px; color: #fff !important; font-size: 17px; font-weight: bold; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            /* REDUCED: Match gap spacing, row padding, and score box heights */
            .matches-wrapper { width: 75%; margin: 0 auto 10px auto; display: flex; flex-direction: column; gap: 8px; }
            .match-row { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 5px 15px; border: 2px solid #cbd5e1; border-radius: 8px; }
            
            .time-badge { position: absolute; top: -9px; left: 15px; background: #fff; color: #64748b; font-size: 10px; font-weight: 800; padding: 0 6px; letter-spacing: 0.5px; }
            
            .match-info { font-weight: bold; font-size: 15px; display: flex; align-items: center; gap: 8px; width: 320px; flex-shrink: 0; color: #0f172a; }
            .match-num { width: 70px; display: inline-block; color: #475569; }
            .ref-info { font-weight: normal; font-size: 13px; font-style: italic; color: #64748b; margin-left: auto; }
            
            .seed-badge { display: inline-block; min-width: 20px; height: 20px; line-height: 20px; padding: 0 4px; text-align: center; border-radius: 4px; font-weight: 900; color: #475569; white-space: nowrap; box-sizing: border-box; }
            .winner-seed { background-color: #cbd5e1 !important; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            
            .game-boxes { display: flex; gap: 16px; flex-grow: 1; justify-content: flex-end; }
            .game-box-group { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: bold; color: #475569; }
            .box { width: 32px; height: 22px; border: 2px solid #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #0f172a; font-weight: bold; }
            
            /* REDUCED: Footer padding */
            .footer { padding-top: 6px; font-size: 14px; font-style: italic; text-align: center; border-top: 2px dashed #94a3b8; margin-top: auto; color: #334155; }
            .footer-primary { font-weight: bold; margin-bottom: 2px; }
            .footer-disclaimer { font-size: 12px; font-weight: 600; color: #64748b; }
        </style>
    </head>
    <body>
    `;

    pools.forEach(pool => {
        // --- NEW: Simplified Advancement Text ---
        const poolTeamsCount = allTeams.filter(t => t.pool_id === pool.id).length;
        const poolAdvancementText = poolTeamsCount > 3 
            ? "1st & 2nd advance to Gold. 3rd & 4th advance to Silver. See brackets for match times and locations."
            : "1st & 2nd advance to Gold. 3rd advances to Silver. See brackets for match times and locations.";

        const poolTeams = allTeams.filter(t => t.pool_id === pool.id).sort((a, b) => a.seed - b.seed);
        const siteColor = getSiteColor(pool.site);
        const poolMatches = allMatches
            .filter(m => m.pool_id === pool.id && !(typeof m.teamA === 'string' && m.teamA.startsWith('seed:')))
            .sort((a, b) => {
                const timeCompare = (a.time || '').localeCompare(b.time || '');
                if (timeCompare !== 0) return timeCompare;
                
                // Tie-breaker: The match featuring Seed 1 (the 1v2 match) always goes last
                const getMatchWeight = (match) => {
                    const tA = allTeams.find(t => t.id === match.teamA);
                    const tB = allTeams.find(t => t.id === match.teamB);
                    const isSeed1 = (tA && parseInt(tA.seed) === 1) || (tB && parseInt(tB.seed) === 1);
                    return isSeed1 ? 1 : 0; 
                };
                
                return getMatchWeight(a) - getMatchWeight(b);
            });
        
        // Calculate Pool Stats Inline
        const teamStats = {};
        poolTeams.forEach(t => teamStats[t.id] = { mw: 0, ml: 0, sw: 0, sl: 0, id: t.id, name: t.name, seed: t.seed });
        
        let matchesPlayed = 0;
        
        poolMatches.forEach(ms => {
            const s1A = parseInt(ms.s1A, 10) || 0;
            const s1B = parseInt(ms.s1B, 10) || 0;
            const s2A = parseInt(ms.s2A, 10) || 0;
            const s2B = parseInt(ms.s2B, 10) || 0;
            const s3A = parseInt(ms.s3A, 10) || 0;
            const s3B = parseInt(ms.s3B, 10) || 0;

            let aSets = 0, bSets = 0;
            if (s1A > s1B) aSets++; else if (s1B > s1A) bSets++;
            if (s2A > s2B) aSets++; else if (s2B > s2A) bSets++;
            if (s3A > s3B) aSets++; else if (s3B > s3A) bSets++;

            if (aSets > 0 || bSets > 0) {
                matchesPlayed++;
                if (teamStats[ms.teamA]) {
                    teamStats[ms.teamA].sw += aSets;
                    teamStats[ms.teamA].sl += bSets;
                    if (aSets > bSets) teamStats[ms.teamA].mw++;
                    else teamStats[ms.teamA].ml++;
                }
                if (teamStats[ms.teamB]) {
                    teamStats[ms.teamB].sw += bSets;
                    teamStats[ms.teamB].sl += aSets;
                    if (bSets > aSets) teamStats[ms.teamB].mw++;
                    else teamStats[ms.teamB].ml++;
                }
            }
        });
        
        const isFinished = poolMatches.length > 0 && matchesPlayed === poolMatches.length;
        
        let sortedStandings = Object.values(teamStats).sort((a, b) => {
            if (b.mw !== a.mw) return b.mw - a.mw;
            if (b.sw !== a.sw) return b.sw - a.sw;
            if (a.sl !== b.sl) return a.sl - b.sl; 
            return a.seed - b.seed;
        });
        
        sortedStandings.forEach((s, i) => {
            teamStats[s.id].rank = i + 1;
        });
        
        const displayTeams = poolTeams.map(t => teamStats[t.id]);
        
        html += `
        <div class="page">
            <div class="header">
                <h1>${tournamentData.name || 'Tournament Name'}</h1>
            </div>
            
            <table class="standings-table">
                <thead>
                    <tr>
                        <th colspan="2" class="pool-info-cell" style="border-right: 1px solid #94a3b8;">
                            <div class="location-name">${pool.site || 'Site TBD'}</div>
                            <div class="pool-badge" style="background-color: ${siteColor};">${pool.name}</div>
                        </th>
                        <th colspan="2">Matches</th>
                        <th colspan="2">Games</th>
                    </tr>
                    <tr>
                        <th style="border-top: 1px solid #94a3b8; width: 30px;">#</th>
                        <th style="border-top: 1px solid #94a3b8;">Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>W</th>
                        <th>L</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayTeams.map((stats) => {
                        let placementBadge = '';
                        if (isFinished) {
                            let badgeClass = 'badge-other';
                            if (stats.rank === 1) badgeClass = 'badge-1st';
                            else if (stats.rank === 2) badgeClass = 'badge-2nd';
                            else if (stats.rank === 3) badgeClass = 'badge-3rd';
                            else if (stats.rank === 4) badgeClass = 'badge-4th';
                            
                            placementBadge = `<span class="placement-badge ${badgeClass}">${getOrdinal(stats.rank)}</span>`;
                        }
                        
                        return `
                        <tr>
                            <td class="team-rank">${stats.seed}</td>
                            <td class="team-name">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>${stats.name}</span>${placementBadge}
                                </div>
                            </td>
                            <td>${toRoman(stats.mw)}</td>
                            <td>${toRoman(stats.ml)}</td>
                            <td>${toRoman(stats.sw)}</td>
                            <td>${toRoman(stats.sl)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        if (poolMatches.length > 0) {
            html += `
            <div class="matches-wrapper">
                ${poolMatches.map((ms, index) => {
                    const tA = poolTeams.find(t => t.id === ms.teamA);
                    const tB = poolTeams.find(t => t.id === ms.teamB);
                    const refTeam = poolTeams.find(t => t.id === ms.ref);
                    
                    // --- NEW: Use formatSeedPrint for Crossover Matches ---
                    const seedA = tA ? tA.seed : formatSeedPrint(ms.teamA);
                    const seedB = tB ? tB.seed : formatSeedPrint(ms.teamB);
                    const refSeed = refTeam ? refTeam.seed : formatSeedPrint(ms.ref);
                    
                    const s1A = parseInt(ms.s1A, 10) || 0;
                    const s1B = parseInt(ms.s1B, 10) || 0;
                    const s2A = parseInt(ms.s2A, 10) || 0;
                    const s2B = parseInt(ms.s2B, 10) || 0;
                    const s3A = parseInt(ms.s3A, 10) || 0;
                    const s3B = parseInt(ms.s3B, 10) || 0;

                    let aSets = 0; let bSets = 0;
                    if (s1A > s1B) aSets++; else if (s1B > s1A) bSets++;
                    if (s2A > s2B) aSets++; else if (s2B > s2A) bSets++;
                    if (s3A > s3B) aSets++; else if (s3B > s3A) bSets++;
                    
                    let winnerId = null;
                    if (aSets > bSets && aSets > 0) winnerId = ms.teamA;
                    if (bSets > aSets && bSets > 0) winnerId = ms.teamB;
                    
                    const displaySeedA = `<span class="seed-badge ${winnerId === ms.teamA ? 'winner-seed' : ''}">${seedA}</span>`;
                    const displaySeedB = `<span class="seed-badge ${winnerId === ms.teamB ? 'winner-seed' : ''}">${seedB}</span>`;
                    
                    const fallbackTime = addMins(poolStart, poolDur * index);
                    const displayTime = formatDisplayTime(ms.time || fallbackTime);
                    
                    return `
                    <div class="match-row">
                        <div class="time-badge">${displayTime}</div>
                        <div class="match-info">
                            <span class="match-num">Match ${index + 1}</span> 
                            <span>${displaySeedA} &nbsp;&nbsp;v&nbsp;&nbsp; ${displaySeedB}</span> 
                            <span class="ref-info">(${refSeed} ref)</span>
                        </div>
                        <div class="game-boxes">
                            <div class="game-box-group">G1 <div class="box">${ms.s1A ?? ''}</div><div class="box">${ms.s1B ?? ''}</div></div>
                            <div class="game-box-group">G2 <div class="box">${ms.s2A ?? ''}</div><div class="box">${ms.s2B ?? ''}</div></div>
                            <div class="game-box-group">G3 <div class="box">${ms.s3A ?? ''}</div><div class="box">${ms.s3B ?? ''}</div></div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            `;
        } else {
            html += `<div style="font-style: italic; color: #64748b; text-align: center; margin: 20px 0;">No matches have been scheduled for this pool yet.</div>`;
        }

        html += `
            <div class="footer">
                <div class="footer-primary">${poolAdvancementText}</div>
                <div class="footer-disclaimer">* Times are estimates. Matches start when courts clear.</div>
            </div>
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