// adminManagePools.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, getTeams, getPools, getMatches, setMatches } from './state.js';
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

    const grid = document.getElementById('adminScoresGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-score-admin-btn')) {
                openScoreModal(e.target.dataset.matchId);
            }
        });
    }
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

function renderAdminPools() {
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
        const poolMatches = allMatches.filter(m => m.pool_id === pool.id).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
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

                            const logoHtml = team.logo_id ? `<img src="${team.logo_id}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 50%; flex-shrink: 0;">` : `<div style="width: 20px; height: 20px; border-radius: 50%; background: ${team.color || '#3b82f6'}; flex-shrink: 0;"></div>`;
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

                <div style="margin-top: auto;">
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
                                
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
                                    <div style="display: flex; gap: 6px; text-align: center; font-size: 0.75rem; color: var(--text-secondary);">
                                        <div style="width: 34px; background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 0;">${s1a}-${s1b}</div>
                                        <div style="width: 34px; background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 0;">${s2a}-${s2b}</div>
                                        <div style="width: 34px; background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 0;">${s3a}-${s3b}</div>
                                    </div>
                                    <button class="btn edit-score-admin-btn" data-match-id="${m.id}" style="font-size: 0.65rem; padding: 3px 12px; background: var(--surface-light); border: 1px solid var(--border-color); color: white; cursor: pointer; border-radius: 4px; width: 100%;">Edit Scores</button>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
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