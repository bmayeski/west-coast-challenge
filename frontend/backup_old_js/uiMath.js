let teamIdToName = {};

export function getStandingsData(pools = [], teams = [], matches = []) {
  const standings = {};

  if (Array.isArray(pools)) {
    pools.forEach(p => {
      const isArray = Array.isArray(p);
      // Use the UUID as the matching key for teams/matches
      const poolKey = isArray ? p[0] : (p.id || 'Unassigned'); 
      // Save the friendly name to display in the UI
      const poolName = isArray ? p[0] : (p.name || 'Unnamed Pool'); 
      const site = isArray ? p[1] : (p.site || p.location || '');
      
      standings[poolKey] = { name: poolName, site: site, teams: [], matches: [], isLocked: false };
    });
  }

  const createEmptyStats = (teamName, poolName = 'Unassigned', color = null, logoId = null, seed = 99) => ({
    name: teamName, pool: poolName, color: color, logoId: logoId, seed: seed,
    wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, place: 0
  });

  const teamStats = {};
  
  // Clear the global dictionary so it doesn't hold stale data
  for (const prop of Object.getOwnPropertyNames(teamIdToName)) {
    delete teamIdToName[prop];
  }

  if (Array.isArray(teams)) {
    teams.forEach(t => {
      const isArray = Array.isArray(t);
      const id = isArray ? t[0] : t.id;
      const name = isArray ? t[1] : (t.name || t.team_name || t.id);
      const pool = isArray ? t[4] : (t.pool_id || t.poolId || t.pool || 'Unassigned');
      const color = isArray ? t[6] : (t.color || null);
      const logoId = isArray ? t[3] : (t.logo_id || t.logoId || null);
      const seedRaw = isArray ? t[5] : t.seed;
      const seed = seedRaw !== undefined && seedRaw !== null && seedRaw !== '' ? parseInt(seedRaw, 10) : 99;

      if (id) teamIdToName[id] = name; 
      if (name) teamStats[name] = createEmptyStats(name, pool, color, logoId, seed);
    });
  }

  if (Array.isArray(matches)) {
    matches.forEach(m => {
      const isArray = Array.isArray(m);
      const mId = isArray ? m[0] : m.id;
      const mType = isArray ? m[1] : (m.match_type || m.type || '');
      const tA_raw = isArray ? m[2] : (m.team_a_id || m.teamA);
      const tB_raw = isArray ? m[3] : (m.team_b_id || m.teamB);
      const ref_raw = isArray ? m[4] : (m.ref_team_id || m.ref);
      const poolKey = isArray ? m[5] : (m.pool_id || m.poolId || m.pool || 'Unassigned');
      const time = isArray ? m[6] : m.time;
      const s1A = isArray ? m[7] : (m.s1a !== undefined ? m.s1a : m.s1A);
      const s1B = isArray ? m[8] : (m.s1b !== undefined ? m.s1b : m.s1B);
      const s2A = isArray ? m[9] : (m.s2a !== undefined ? m.s2a : m.s2A);
      const s2B = isArray ? m[10] : (m.s2b !== undefined ? m.s2b : m.s2B);
      const s3A = isArray ? m[11] : (m.s3a !== undefined ? m.s3a : m.s3A);
      const s3B = isArray ? m[12] : (m.s3b !== undefined ? m.s3b : m.s3B);
      const status = isArray ? m[13] : (m.status || 'Pending');

      if (!tA_raw || !tB_raw) return;
      
      const teamAName = teamIdToName[tA_raw] || tA_raw;
      const teamBName = teamIdToName[tB_raw] || tB_raw;
      const refName = teamIdToName[ref_raw] || ref_raw || '-';

      const isPoolMatch = mType.toLowerCase() === 'pool' || mType.toLowerCase() === 'pool play';
      
      const uiMatch = {
         id: mId, time: time, status: status,
         teamA: teamAName, teamB: teamBName, ref: refName,
         s1A, s1B, s2A, s2B, s3A, s3B
      };

      if (isPoolMatch && standings[poolKey]) {
          standings[poolKey].matches.push(uiMatch);
      }

      const isComplete = status === 'Complete' || status === 'Final';
      if (!isComplete || !isPoolMatch) return;

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

      processSet(s1A, s1B);
      processSet(s2A, s2B);
      
      // BEST OF 3 LOGIC: Only count 3rd set if nobody has 2 wins yet
      if (setsA < 2 && setsB < 2) {
          processSet(s3A, s3B);
      }

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

  Object.values(teamStats).forEach(st => {
    st.pointDiff = st.pointsFor - st.pointsAgainst;
    const poolKey = st.pool;
    if (!standings[poolKey]) standings[poolKey] = { name: poolKey, site: '', teams: [], matches: [] };
    standings[poolKey].teams.push(st);
  });

  Object.keys(standings).forEach(poolName => {
    const pool = standings[poolName];

    // 1. Calculate how many matches each team has left to play
    pool.teams.forEach(t => {
      const teamMatches = pool.matches ? pool.matches.filter(m => m.teamA === t.name || m.teamB === t.name) : [];
      const played = teamMatches.filter(m => m.status === 'Complete' || m.status === 'Final').length;
      t.remainingMatches = teamMatches.length > 0 ? (teamMatches.length - played) : 0;
    });

    // 2. Calculate the live provisional rankings
    let rankedTeams = [...pool.teams].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const setDiffA = a.setsWon - a.setsLost; const setDiffB = b.setsWon - b.setsLost;
      if (setDiffB !== setDiffA) return setDiffB - setDiffA;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.seed - b.seed;
    });

    // 3. Assign places ONLY if the team is mathematically locked
    rankedTeams.forEach((t, i) => {
        // Require at least 1 match played before we consider them "locked"
        let isLocked = (t.wins + (t.losses || 0)) > 0;

        if (isLocked) {
            for (let j = 0; j < rankedTeams.length; j++) {
                if (i === j) continue;
                const o = rankedTeams[j];

                if (j < i) { 
                    // 'o' is currently ahead of 't'. Can 't' mathematically catch them?
                    if (t.remainingMatches === 0 && o.remainingMatches === 0) {
                        // Both finished their schedules, relative rank is permanently locked
                    } else if (t.wins + t.remainingMatches >= o.wins) {
                        isLocked = false;
                        break;
                    }
                } else { 
                    // 'o' is currently behind 't'. Can 'o' mathematically catch them?
                    if (t.remainingMatches === 0 && o.remainingMatches === 0) {
                        // Both finished their schedules, relative rank is permanently locked
                    } else if (o.wins + o.remainingMatches >= t.wins) {
                        isLocked = false;
                        break;
                    }
                }
            }
        }

        t.place = isLocked ? (i + 1) : 0;
    });

    // 4. Force the visible UI to ALWAYS stay sorted by original Seed
    pool.teams.sort((a, b) => a.seed - b.seed);
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

      const pendingMatches = poolMatches.filter(m => {
          const status = (m.status || '').toLowerCase();
          return status !== 'complete' && status !== 'final';
      }).length;

      let canAssignSeeds = false;
      if (pendingMatches === 0) {
          canAssignSeeds = true; 
      } else if (pendingMatches <= 2 && poolTeams.length >= 4) {
          const sortedByRank = [...poolTeams].sort((a, b) => a.place - b.place);
          let topTeamWins = sortedByRank[0]?.wins || 0;
          let thirdTeamWins = sortedByRank[2]?.wins || 0;
          
          if (topTeamWins > thirdTeamWins + (pendingMatches * 1)) {
              canAssignSeeds = true;
          }
      }

      if (canAssignSeeds) {
        const poolClean = poolKey.replace(/pool/i, '').trim().toLowerCase(); 
        
        poolTeams.forEach((team) => {
          const rank = team.place; 
          const ordinal = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
          
          seedMap[`pool ${poolClean} - ${rank}${ordinal}`] = team.name; 
          seedMap[`pool ${poolClean} - ${rank}`] = team.name;          
          seedMap[`pool ${poolClean} #${rank}`] = team.name;            
        });
      }
    });
  }

  const divisionMatches = (matches || []).filter(m => {
    const isArray = Array.isArray(m);
    const mId = (isArray ? m[0] : m.id || '').toUpperCase();
    if (activeDivision === 'Gold' && mId.startsWith('G')) return true;
    if (activeDivision === 'Silver' && mId.startsWith('S')) return true;
    return false;
  });

  const resolvedMatches = divisionMatches.map(m => {
    const isArray = Array.isArray(m);
    const mId = isArray ? m[0] : m.id;
    const tA_raw = isArray ? m[2] : (m.team_a_id || m.teamA);
    const tB_raw = isArray ? m[3] : (m.team_b_id || m.teamB);
    const ref_raw = isArray ? m[4] : (m.ref_team_id || m.ref);
    const time = isArray ? m[6] : m.time;
    const s1A = isArray ? m[7] : (m.s1a !== undefined ? m.s1a : m.s1A);
    const s1B = isArray ? m[8] : (m.s1b !== undefined ? m.s1b : m.s1B);
    const s2A = isArray ? m[9] : (m.s2a !== undefined ? m.s2a : m.s2A);
    const s2B = isArray ? m[10] : (m.s2b !== undefined ? m.s2b : m.s2B);
    const s3A = isArray ? m[11] : (m.s3a !== undefined ? m.s3a : m.s3A);
    const s3B = isArray ? m[12] : (m.s3b !== undefined ? m.s3b : m.s3B);
    const status = isArray ? m[13] : (m.status || 'Pending');

    let nameA = teamIdToName[tA_raw] || tA_raw;
    let nameB = teamIdToName[tB_raw] || tB_raw;
    
    if (nameA && seedMap[nameA.toLowerCase()]) nameA = seedMap[nameA.toLowerCase()];
    if (nameB && seedMap[nameB.toLowerCase()]) nameB = seedMap[nameB.toLowerCase()];

    const matchIdString = (mId || '').toUpperCase();
    let roundType = 'Matches';
    
    if (matchIdString.startsWith('GS') || matchIdString.startsWith('SS')) {
        roundType = 'Seeding';
    } else if (matchIdString === 'G1' || matchIdString === 'G2' || matchIdString === 'G3' || matchIdString === 'G4' || 
               matchIdString === 'S1' || matchIdString === 'S2' || matchIdString === 'S3' || matchIdString === 'S4') {
        roundType = 'Quarterfinals';
    } else if (matchIdString === 'G5' || matchIdString === 'G6' || matchIdString === 'S5' || matchIdString === 'S6') {
        roundType = 'Semifinals';
    } else if (matchIdString === 'G7' || matchIdString === 'S7') {
        roundType = 'Finals';
    }

    return {
      id: mId,
      type: roundType, 
      time: time,
      status: status,
      teamA: nameA || 'TBD',
      teamB: nameB || 'TBD',
      ref: teamIdToName[ref_raw] || ref_raw || '-',
      s1A, s1B, s2A, s2B, s3A, s3B
    };
  });

  return { division: activeDivision, matches: resolvedMatches };
}