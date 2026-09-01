import { getSiteColor, lightenColor, getScoreStyle, formatTime } from './utils.js';

export function renderPools(standingsData) {
  const container = document.getElementById('publicPoolsList'); 
  if (!container || !standingsData) return;

  let html = '';

  Object.keys(standingsData).forEach(poolName => {
    const pool = standingsData[poolName];
    const siteColor = getSiteColor(pool.site);

    // 1. Build the styled card header and standings table
    // ADDED: overflow-x wrapper and min-width to prevent cards from bursting
    html += `
      <div class="data-card" style="overflow: hidden;">
        <div class="card-header" style="background-color: ${siteColor}; color: #FFFFFF; border-bottom: none;">
          <span>🏐 ${pool.name || poolName}</span>
          <span style="font-size: 0.75rem; font-weight: normal;">${pool.site || ''}</span>
        </div>
        
        <div style="overflow-x: auto; width: 100%;">
          <table class="standings-table" style="min-width: 380px; width: 100%;">
            <thead>
              <tr>
                <th style="width: 25px;">Seed</th>
                <th style="text-align: left;">Team</th>
                <th colspan="2">Matches</th>
                <th colspan="2">Sets</th>
                <th style="width: 45px; white-space: nowrap;">Set +/-</th>
                <th style="width: 45px; white-space: nowrap;">Pt +/-</th>
              </tr>
              <tr style="background-color: var(--surface-dark);">
                <th></th>
                <th></th>
                <th style="width: 25px; color: var(--text-primary); text-align: center;">W</th>
                <th style="width: 25px; color: var(--text-primary); text-align: center;">L</th>
                <th style="width: 25px; color: var(--text-secondary); text-align: center;">W</th>
                <th style="width: 25px; color: var(--text-secondary); text-align: center;">L</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
    `;

    // 2. Loop through the teams and build the rows
    pool.teams.forEach((team) => {
      let setDiff = (team.setsWon || 0) - (team.setsLost || 0);
      let formattedSetDiff = setDiff > 0 ? '+' + setDiff : setDiff;
      let formattedPtDiff = team.pointDiff > 0 ? '+' + team.pointDiff : (team.pointDiff || 0);
      
      let diffStyleSet = setDiff > 0 ? "color: var(--text-primary); font-weight: 600;" : "color: var(--text-secondary); font-weight: normal;";
      let diffStylePt = team.pointDiff > 0 ? "color: var(--text-primary); font-weight: 600;" : "color: var(--text-secondary); font-weight: normal;";

      const logoUrl = team.logo_id || team.logoId; // Catch both formats just in case
      const logoHTML = logoUrl 
        ? `<img src="${logoUrl}" style="width: 25px; height: 25px; object-fit: contain; flex-shrink: 0; margin-right: 8px;" alt="${team.name} logo">`
        : `<div style="width: 25px; height: 25px; background: var(--surface-lighter); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; color: var(--text-secondary); flex-shrink: 0; margin-right: 8px;">?</div>`;
      
        const displayColor = lightenColor(team.color, 0.4);

      // GENERATE THE SLEEK LEFT-EDGE FINISH BADGE
      let finishBadge = '';
      if (team.place) {
          let badgeColor = team.place === 1 ? '#D4AF37' : team.place === 2 ? '#94A3B8' : team.place === 3 ? '#B08D57' : 'var(--surface-lighter)';
          let textColor = team.place === 4 ? 'var(--text-secondary)' : '#FFF';
          
          // Floating circle with just the number, overlapping the left edge
          finishBadge = `<div style="position: absolute; left: -2px; top: 50%; transform: translateY(-50%); background-color: ${badgeColor}; color: ${textColor}; font-size: 0.7rem; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; box-shadow: 1px 1px 3px rgba(0,0,0,0.5); z-index: 2;">${team.place}</div>`;
      }

      // GENERATE THE INLINE FINISH BADGE OR SHOW SEED
      let seedDisplay = team.seed !== 99 ? team.seed : '-';
      
      if (team.place) {
          let badgeColor = team.place === 1 ? '#D4AF37' : team.place === 2 ? '#94A3B8' : team.place === 3 ? '#B08D57' : 'var(--surface-lighter)';
          let textColor = team.place === 4 ? 'var(--text-secondary)' : '#FFF';
          let ordinal = team.place === 1 ? 'st' : team.place === 2 ? 'nd' : team.place === 3 ? 'rd' : 'th';
          
          // Replaces the plain seed number with a compact, centered badge
          seedDisplay = `<div style="background-color: ${badgeColor}; color: ${textColor}; font-size: 0.65rem; padding: 3px 0; width: 26px; text-align: center; border-radius: 4px; font-weight: bold; margin: 0 auto;">${team.place}${ordinal}</div>`;
      }

      // FIX: The badge is now safely inline, and we removed the absolute positioning.
      html += `
              <tr>
                <td style="color: var(--text-secondary); font-size: 0.75rem; width: 35px; text-align: center; padding: 0 4px; vertical-align: middle;">
                    ${seedDisplay}
                </td>
                <td style="max-width: 175px;">
                  <div class="team-name-wrapper" style="display: flex; align-items: center;">
                    ${logoHTML}
                    <span style="color: ${displayColor}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${team.name}">${team.name}</span>
                  </div>
                </td>
                <td style="color: var(--text-primary); font-weight: bold; width: 25px; text-align: center;">${team.wins || 0}</td>
                <td style="color: var(--text-primary); font-weight: bold; width: 25px; text-align: center;">${team.losses || 0}</td>
                <td style="color: var(--text-secondary); font-weight: normal; width: 25px; text-align: center;">${team.setsWon || 0}</td>
                <td style="color: var(--text-secondary); font-weight: normal; width: 25px; text-align: center;">${team.setsLost || 0}</td>
                <td style="${diffStyleSet} width: 45px; text-align: center;">${formattedSetDiff}</td>
                <td style="${diffStylePt} width: 45px; text-align: center;">${formattedPtDiff}</td>
              </tr>
      `;
    });

    html += `</tbody></table></div>`; // Closes responsive wrapper

    // 3. Build the Match Breakdown Table (if matches exist)
    if (pool.matches && pool.matches.length > 0) {
      // ADDED: Overflow wrapper here as well
      html += `
        <div style="overflow-x: auto; width: 100%;">
          <table class="breakdown-table" style="margin-top: 10px; background-color: var(--surface-lighter); min-width: 380px;">
            <thead>
              <tr>
                <th style="text-align: left; padding-left: 15px;">Match Breakdown</th>
                <th colspan="2">Game 1</th>
                <th colspan="2">Game 2</th>
                <th colspan="2">Game 3</th>
              </tr>
            </thead>
            <tbody>
      `;

      pool.matches.forEach((match) => {
        let isComplete = match.status === 'Complete' || match.status === 'Final';
        let opacity = isComplete ? '1' : '0.5';
        
        let setsA = 0; let setsB = 0;
        if (parseInt(match.s1A) > parseInt(match.s1B)) setsA++; else if (parseInt(match.s1B) > parseInt(match.s1A)) setsB++;
        if (parseInt(match.s2A) > parseInt(match.s2B)) setsA++; else if (parseInt(match.s2B) > parseInt(match.s2A)) setsB++;
        if (parseInt(match.s3A) > parseInt(match.s3B)) setsA++; else if (parseInt(match.s3B) > parseInt(match.s3A)) setsB++;

        let teamAStyle = (isComplete && setsA > setsB) ? "color: var(--accent-orange); font-weight: 600;" : (isComplete ? "color: var(--text-secondary);" : "color: var(--text-primary); font-weight: 500;");
        let teamBStyle = (isComplete && setsB > setsA) ? "color: var(--accent-orange); font-weight: 600;" : (isComplete ? "color: var(--text-secondary);" : "color: var(--text-primary); font-weight: 500;");

        html += `
              <tr style="opacity: ${opacity};">
                <td style="text-align: left; padding-left: 15px;">
                  <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                    <span style="${teamAStyle}">${match.teamA}</span> 
                    <span style="color: var(--text-secondary); font-weight: normal; font-size: 0.75rem;">vs</span> 
                    <span style="${teamBStyle}">${match.teamB}</span>
                  </div>
                  <div style="font-size: 0.7rem; color: var(--text-secondary);">
                     Ref: ${match.ref || '-'} <span style="margin-left: 8px; color: var(--accent-orange); font-weight: bold;">🕒 ${formatTime(match.time)}</span>
                  </div>
                </td>
                <td style="${getScoreStyle(match.s1A, match.s1B)} border-right: 1px solid var(--surface-dark); text-align: center;">${match.s1A || "-"}</td>
                <td style="${getScoreStyle(match.s1B, match.s1A)} border-right: 1px solid var(--border-color); text-align: center;">${match.s1B || "-"}</td>
                <td style="${getScoreStyle(match.s2A, match.s2B)} border-right: 1px solid var(--surface-dark); text-align: center;">${match.s2A || "-"}</td>
                <td style="${getScoreStyle(match.s2B, match.s2A)} border-right: 1px solid var(--border-color); text-align: center;">${match.s2B || "-"}</td>
                <td style="${getScoreStyle(match.s3A, match.s3B)} border-right: 1px solid var(--surface-dark); text-align: center;">${match.s3A || "-"}</td>
                <td style="${getScoreStyle(match.s3B, match.s3A)} text-align: center;">${match.s3B || "-"}</td>
              </tr>
        `;
      });
      html += `</tbody></table></div>`; // Closes responsive wrapper
    }

    html += `</div>`; 
  });

  html += `<div style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; font-style: italic; margin-top: 15px; padding-bottom: 20px;">* Times are estimates. Matches start when courts clear.</div>`;
  container.innerHTML = html;
}