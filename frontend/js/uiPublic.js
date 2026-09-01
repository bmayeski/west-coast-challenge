// uiPublic.js
import { getTournamentData, getPools, getMatches, getTeams } from './state.js';
import { getAllPoolStandings } from './uiMath.js';
import { getSiteColor, formatTime, lightenColor, ensureReadableColor } from './utils.js';

export function renderPublicInfo() {
    const container = document.getElementById('dynamicInfoContainer');
    const data = getTournamentData();
    
    if (!container || !data) return;

    if (data.info_data && Array.isArray(data.info_data)) {
        let html = `<style>
            .info-content p { margin: 0 0 8px 0; }
            .info-content p:last-child { margin-bottom: 0; }
            .info-content ul { margin: 4px 0; padding-left: 20px; }
            .sub-content-highlight p, .alert-content-box p { margin: 0 !important; }
        </style>`;

        html += data.info_data.map(section => {
            let cleanContent = (section.content || '').replace(/(<p><br><\/p>\s*)+$/, '');

            const isDirector = section.title.toLowerCase().includes('director');
            const headerAlign = isDirector ? 'justify-content: center;' : '';
            const contentAlign = isDirector ? 'text-align: center;' : '';

            const subContentHtml = section.subContent && section.subContent !== '<p><br></p>'
                ? `<div class="sub-content-highlight" style="margin-top: 8px; padding: 12px 15px; background: rgba(255, 95, 0, 0.05); border-left: 4px solid var(--accent-orange); border-radius: 4px; color: var(--text-primary); font-size: 0.9rem;">
                     ${section.subContent}
                   </div>` 
                : '';

            const alertContentHtml = section.alertContent && section.alertContent !== '<p><br></p>'
                ? `<div class="alert-content-box" style="margin-top: 8px; padding: 10px 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; color: #ef4444; font-size: 0.85rem; font-weight: bold; text-align: center; text-transform: uppercase;">
                     ${section.alertContent}
                   </div>` 
                : '';

            return `
            <div style="margin-bottom: 15px; background: var(--surface-dark); padding: 12px 15px; border-radius: 6px; border: 1px solid var(--border-color); border-top: 4px solid var(--accent-orange);">
                <h3 style="color: var(--text-primary); margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; font-size: 0.95rem; ${headerAlign}">
                    <span style="font-size: 1rem;">${section.icon || ''}</span> ${section.title}
                </h3>
                <div class="info-content" style="color: var(--text-secondary); line-height: 1.4; font-size: 0.85rem; ${contentAlign}">
                    ${cleanContent}
                </div>
                ${subContentHtml}
                ${alertContentHtml}
            </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p style="color: var(--text-secondary);">No information has been posted for this tournament yet.</p>';
    }
}

function getOrdinalSuffix(i) {
    const j = i % 10, k = i % 100;
    if (j == 1 && k != 11) return i + "st";
    if (j == 2 && k != 12) return i + "nd";
    if (j == 3 && k != 13) return i + "rd";
    return i + "th";
}

export function renderPublicPools() {
    const container = document.getElementById('publicPoolsList');
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

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 15px;">';
    
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
            
            <div style="padding: 10px 12px; flex-grow: 1; display: flex; flex-direction: column;">
                
                <table style="width: 100%; text-align: center; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 12px; table-layout: fixed;">
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

                            const logoHtml = team.logo_id ? `<img src="${team.logo_id}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 4px; flex-shrink: 0;">` : `<div style="width: 20px; height: 20px; border-radius: 4px; background: ${team.color || '#3b82f6'}; flex-shrink: 0;"></div>`;
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

                <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 2px;">
                        <div style="display: flex; align-items: baseline; gap: 10px; min-width: 0;">
                            <span style="white-space: nowrap;">Match Breakdown</span>
                            <span style="font-size: 0.6rem; font-style: italic; color: var(--accent-orange); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">*All times are estimates</span>
                        </div>
                        <div style="display: flex; gap: 0; text-align: center; flex-shrink: 0; width: 165px;">
                            <div style="width: 55px; padding: 0 4px; box-sizing: border-box;">Game 1</div>
                            <div style="width: 55px; padding: 0 4px; box-sizing: border-box;">Game 2</div>
                            <div style="width: 55px; padding: 0 4px; box-sizing: border-box;">Game 3</div>
                        </div>
                    </div>
                    
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

                            let matchState = 'pending';
                            let matchWinnerId = null;

                            if (isComplete) {
                                matchState = 'completed';
                                let t1Sets = 0, t2Sets = 0;
                                if (s1a !== '-' && s1b !== '-') { if (Number(s1a) > Number(s1b)) t1Sets++; else if (Number(s1b) > Number(s1a)) t2Sets++; }
                                if (s2a !== '-' && s2b !== '-') { if (Number(s2a) > Number(s2b)) t1Sets++; else if (Number(s2b) > Number(s2a)) t2Sets++; }
                                if (s3a !== '-' && s3b !== '-') { if (Number(s3a) > Number(s3b)) t1Sets++; else if (Number(s3b) > Number(s3a)) t2Sets++; }
                                
                                if (t1Sets > t2Sets) matchWinnerId = m.teamA;
                                else if (t2Sets > t1Sets) matchWinnerId = m.teamB;
                            } else if (m.status === 'active' || hasScores || isNextMatch) {
                                matchState = 'active';
                            }

                            let statusBadge = '';
                            if (matchState === 'completed') {
                                statusBadge = `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid #334155; color: #94a3b8; border-radius: 4px; font-size: 0.7rem;" title="Completed">✔</div>`;
                            } else if (matchState === 'active') {
                                statusBadge = `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid #22c55e; background: rgba(34, 197, 94, 0.1); color: #22c55e; border-radius: 4px; font-size: 0.65rem; padding-left: 2px;" title="Active">▶</div>`;
                            } else {
                                statusBadge = `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid var(--accent-orange); color: var(--accent-orange); border-radius: 4px; font-size: 0.8rem;" title="Upcoming">-</div>`;
                            }

                            const refBadge = `<span style="border: 1px solid #334155; color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; display: inline-block; white-space: nowrap;">Ref: <span style="color: #cbd5e1; font-weight: 500;">${refName}</span></span>`;

                            let tAColor = 'white', tBColor = 'white';
                            let tAWeight = 'normal', tBWeight = 'normal';

                            if (isComplete) {
                                tAColor = (matchWinnerId === m.teamA) ? 'var(--accent-orange)' : '#64748b';
                                tBColor = (matchWinnerId === m.teamB) ? 'var(--accent-orange)' : '#64748b';
                                tAWeight = (matchWinnerId === m.teamA) ? 'bold' : 'normal';
                                tBWeight = (matchWinnerId === m.teamB) ? 'bold' : 'normal';
                            }

                            const renderScoreBox = (score, isWinner) => {
                                if (score === null || score === undefined || score === '' || score === '-') {
                                    return `<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: #475569; border: 1px solid transparent; box-sizing: border-box;">-</div>`;
                                }
                                if (isWinner) {
                                    return `<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid var(--accent-orange); border-radius: 4px; font-weight: bold; color: white; box-sizing: border-box;">${score}</div>`;
                                }
                                return `<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: #94a3b8; border: 1px solid transparent; box-sizing: border-box;">${score}</div>`;
                            };

                            const s1A_html = renderScoreBox(s1a, s1a !== '-' && parseFloat(s1a) > parseFloat(s1b));
                            const s1B_html = renderScoreBox(s1b, s1b !== '-' && parseFloat(s1b) > parseFloat(s1a));
                            const s2A_html = renderScoreBox(s2a, s2a !== '-' && parseFloat(s2a) > parseFloat(s2b));
                            const s2B_html = renderScoreBox(s2b, s2b !== '-' && parseFloat(s2b) > parseFloat(s2a));
                            const s3A_html = renderScoreBox(s3a, s3a !== '-' && parseFloat(s3a) > parseFloat(s3b));
                            const s3B_html = renderScoreBox(s3b, s3b !== '-' && parseFloat(s3b) > parseFloat(s3a));

                            const isActive = matchState === 'active';
                            const cardBg = isActive ? '#24334a' : '#1e293b';
                            const cardBorder = isActive ? '1px solid var(--accent-orange)' : '1px solid #334155';
                            const cardLeftBorder = isActive ? '4px solid var(--accent-orange)' : '4px solid #334155';
                            const cardShadow = isActive ? '0 4px 15px rgba(0,0,0,0.5)' : 'none';

                            return `
                            <div style="background: ${cardBg}; border-radius: 8px; border: ${cardBorder}; border-left: ${cardLeftBorder}; padding: 10px; display: flex; flex-direction: column; gap: 6px; overflow: hidden; box-shadow: ${cardShadow};">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                                        ${statusBadge}
                                        ${refBadge}
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--accent-orange); font-size: 0.75rem; font-weight: bold; white-space: nowrap;">🕒 ${formatTime(m.time)}</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="color: ${tAColor}; font-weight: ${tAWeight}; font-size: 0.85rem; flex-grow: 1; padding-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t1Name}</div>
                                        <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                                            ${s1A_html} ${s2A_html} ${s3A_html}
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="color: ${tBColor}; font-weight: ${tBWeight}; font-size: 0.85rem; flex-grow: 1; padding-right: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t2Name}</div>
                                        <div style="display: flex; gap: 4px; font-size: 0.8rem; padding-left: 6px; border-left: 1px solid #334155;">
                                            ${s1B_html} ${s2B_html} ${s3B_html}
                                        </div>
                                    </div>
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