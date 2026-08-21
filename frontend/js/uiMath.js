let teamIdToName = {};

export function getStandingsData(pools = [], teams = [], matches = []) {
  const standings = {};

  // 1. Initialize Pools
  if (Array.isArray(pools)) {
    pools.forEach(p => {
      const poolName = typeof p === 'string' ? p : (p.pool_id || p.name || p.id || 'Pool 1');
      const site = p.site || p.location || '';
      standings[poolName] = { name: poolName, site: site, teams: [], matches: [] };
    });
  }

  const createEmptyStats = (teamName, poolName = 'Unassigned', color = null, logoId = null) => ({
    name: teamName,
    pool: poolName,
    color: color,
    logoId: logoId,
    wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0
  });

  // 2. Initialize Teams and Build ID Dictionary
  const teamStats = {};
  const teamIdToName = {}; // <--- Our new translator dictionary

  if (Array.isArray(teams)) {
    teams.forEach(t => {
      const name = typeof t === 'string' ? t : (t.name || t.team_name || t.id);
      const pool = typeof t === 'object' ? (t.pool_id || t.poolId || t.pool || 'Unassigned') : 'Unassigned';
      
      // Grab colors and logos
      const color = t.color || null;
      const logoId = t.logo_id || t.logoId || null;

      teamIdToName[t.id] = name; // Map the ID to the Name

      if (name) teamStats[name] = createEmptyStats(name, pool, color, logoId);
    });
  }

  // 3. Process Matches (With Translation)
  if (Array.isArray(matches)) {
    matches.forEach(m => {
      if (!m.teamA || !m.teamB) return;
      
      // TRANSLATE: Convert the raw IDs into actual Team Names!
      const teamAName = teamIdToName[m.teamA] || m.teamA;
      const teamBName = teamIdToName[m.teamB] || m.teamB;
      const refName = teamIdToName[m.ref] || m.ref || '-';

      const poolKey = m.pool_id || m.poolId || m.pool || 'Unassigned';
      if (standings[poolKey]) {
          // Push the Translated Match into the UI Breakdown Table
          standings[poolKey].matches.push({
              ...m,
              teamA: teamAName,
              teamB: teamBName,
              ref: refName
          });
      }

      const isComplete = m.status === 'Complete' || m.status === 'Final';
      if (!isComplete) return;

      if (!teamStats[teamAName]) teamStats[teamAName] = createEmptyStats(teamAName);
      if (!teamStats[teamBName]) teamStats[teamBName] = createEmptyStats(teamBName);

      let setsA = 0, setsB = 0, ptsA = 0, ptsB = 0;

      const processSet = (sA, sB) => {
        const scoreA = parseInt(sA, 10); const scoreB = parseInt(sB, 10);
        if (!isNaN(scoreA) && !isNaN(scoreB)) {
          ptsA += scoreA; ptsB += scoreB;
          if (scoreA > scoreB) setsA++; else if (scoreB > scoreA) setsB++;
        }
      };

      processSet(m.s1A, m.s1B);
      processSet(m.s2A, m.s2B);
      processSet(m.s3A, m.s3B);

      teamStats[teamAName].setsWon += setsA; teamStats[teamAName].setsLost += setsB;
      teamStats[teamAName].pointsFor += ptsA; teamStats[teamAName].pointsAgainst += ptsB;

      teamStats[teamBName].setsWon += setsB; teamStats[teamBName].setsLost += setsA;
      teamStats[teamBName].pointsFor += ptsB; teamStats[teamBName].pointsAgainst += ptsA;

      if (setsA > setsB) {
        teamStats[teamAName].wins++; teamStats[teamBName].losses++;
      } else if (setsB > setsA) {
        teamStats[teamBName].wins++; teamStats[teamAName].losses++;
      }
    });
  }

  // 4. Assign and Sort
  Object.values(teamStats).forEach(st => {
    st.pointDiff = st.pointsFor - st.pointsAgainst;
    const poolKey = st.pool;
    if (!standings[poolKey]) standings[poolKey] = { name: poolKey, site: '', teams: [], matches: [] };
    standings[poolKey].teams.push(st);
  });

  Object.keys(standings).forEach(poolName => {
    standings[poolName].teams.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const setDiffA = a.setsWon - a.setsLost; const setDiffB = b.setsWon - b.setsLost;
      if (setDiffB !== setDiffA) return setDiffB - setDiffA;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.pointsFor - a.pointsFor;
    });
  });

  return standings;
}

export function getBracketData(activeDivision = "Gold", standings = {}, matches = []) {
  const seedMap = {};
  
  if (standings && typeof standings === 'object') {
    Object.keys(standings).forEach(poolKey => {
      const pool = standings[poolKey];
      const poolTeams = pool.teams || [];
      const poolMatches = pool.matches || [];

      // Check how many matches are still pending in this pool
      const pendingMatches = poolMatches.filter(m => {
          const status = (m.status || '').toLowerCase();
          return status !== 'complete' && status !== 'final';
      }).length;

      // SMART LOCK: If there are 2 or fewer matches left, check if the top seeds are mathematically safe
      // (Or if 0 matches are pending, they are 100% locked)
      let canAssignSeeds = false;

      if (pendingMatches === 0) {
          canAssignSeeds = true; // All matches done, fully locked
      } else if (pendingMatches <= 2 && poolTeams.length >= 4) {
          // Check if 1st place has more wins than 3rd place plus the remaining matches available
          let topTeamWins = poolTeams[0].wins || 0;
          let thirdTeamWins = poolTeams[2].wins || 0;
          
          // If the leader's win total is mathematically out of reach, lock the top seeds early!
          if (topTeamWins > thirdTeamWins + (pendingMatches * 1)) {
              canAssignSeeds = true;
          }
      }

      if (canAssignSeeds) {
        const poolClean = poolKey.replace(/pool/i, '').trim().toLowerCase(); 
        
        poolTeams.forEach((team, index) => {
          const rank = index + 1;
          const ordinal = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
          
          seedMap[`pool ${poolClean} - ${rank}${ordinal}`] = team.name; 
          seedMap[`pool ${poolClean} - ${rank}`] = team.name;           
          seedMap[`pool ${poolClean} #${rank}`] = team.name;            
        });
      }
    });
  }

  // 2. Find Bracket Matches for the Selected Division
  const divisionMatches = (matches || []).filter(m => {
    if (!m.type) return false;
    
    // Support a dedicated 'division' column if you have one, or check the 'type' column
    const typeStr = m.type.toLowerCase();
    const divStr = (m.division || m.type || '').toLowerCase();
    const targetDiv = activeDivision.toLowerCase();

    // Check if it's a bracket round AND if it includes "gold" or "silver"
    const isBracketMatch = typeStr.includes("quarter") || typeStr.includes("semi") || typeStr.includes("final") || typeStr.includes("seeding");
    const isCorrectDivision = divStr.includes(targetDiv);

    return isBracketMatch && isCorrectDivision;
  });

  // 3. Translate IDs -> Seed Map -> Fallback
  const resolvedMatches = divisionMatches.map(match => {
    let nameA = teamIdToName[match.teamA] || match.teamA;
    let nameB = teamIdToName[match.teamB] || match.teamB;
    
    if (nameA && seedMap[nameA.toLowerCase()]) nameA = seedMap[nameA.toLowerCase()];
    if (nameB && seedMap[nameB.toLowerCase()]) nameB = seedMap[nameB.toLowerCase()];

    return {
      ...match,
      teamA: nameA || 'TBD',
      teamB: nameB || 'TBD',
      ref: teamIdToName[match.ref] || match.ref || '-'
    };
  });

  return { division: activeDivision, matches: resolvedMatches };
}