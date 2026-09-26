// adminSchedule.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, getTeams, getPools, setMatches } from './state.js'; 
import { renderPublicPools } from './uiPublic.js';
import { getAllPoolStandings } from './uiMath.js';

// Standard USAV bracket templates. Numbers represent array indexes (0 = Seed 1, 1 = Seed 2, etc.)
const SCHEDULE_TEMPLATES = {
    3: [
        [0, 2, 1], // Match 1: 1 v 3 (Ref 2)
        [1, 2, 0], // Match 2: 2 v 3 (Ref 1)
        [0, 1, 2]  // Match 3: 1 v 2 (Ref 3)
    ],
    4: [
        [0, 2, 1], // Match 1: 1 v 3 (Ref 2)
        [1, 3, 0], // Match 2: 2 v 4 (Ref 1)
        [0, 3, 2], // Match 3: 1 v 4 (Ref 3)
        [1, 2, 0], // Match 4: 2 v 3 (Ref 1)
        [2, 3, 1], // Match 5: 3 v 4 (Ref 2)
        [0, 1, 3]  // Match 6: 1 v 2 (Ref 4)
    ],
    5: [
        [0, 4, 2], // Match 1: 1 v 5 (Ref 3)
        [1, 3, 0], // Match 2: 2 v 4 (Ref 1)
        [0, 3, 4], // Match 3: 1 v 4 (Ref 5)
        [1, 2, 0], // Match 4: 2 v 3 (Ref 1)
        [2, 4, 1], // Match 5: 3 v 5 (Ref 2)
        [0, 2, 4], // Match 6: 1 v 3 (Ref 5)
        [3, 4, 0], // Match 7: 4 v 5 (Ref 1)
        [0, 1, 3], // Match 8: 1 v 2 (Ref 4)
        [2, 3, 1], // Match 9: 3 v 4 (Ref 2)
        [1, 4, 2]  // Match 10: 2 v 5 (Ref 3)
    ]
};

export function initSchedule() {
    const generateBtn = document.getElementById('generateScheduleBtn');
    const saveBtn = document.getElementById('saveScheduleBtn');

    if (generateBtn) {
        generateBtn.addEventListener('click', handleAutoGenerate);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSchedule);
        
        if (!document.getElementById('clearScheduleBtn')) {
            const clearBtn = document.createElement('button');
            clearBtn.id = 'clearScheduleBtn';
            clearBtn.className = 'btn';
            clearBtn.style.background = 'rgba(239, 68, 68, 0.2)'; 
            clearBtn.style.color = '#ef4444';
            clearBtn.style.border = '1px solid #ef4444';
            clearBtn.style.marginLeft = '10px';
            clearBtn.innerText = 'Clear Schedule';
            clearBtn.addEventListener('click', handleClearSchedule);
            saveBtn.parentNode.insertBefore(clearBtn, saveBtn.nextSibling);
        }
    }
}

export async function loadSchedule() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('time', { ascending: true }); 

    if (error) {
        console.error("Error loading schedule:", error);
        return;
    }

    if (matches) {
        if (typeof setMatches === 'function') setMatches(matches);
        
        // ANTI-RACE CONDITION: Pause up to 1 second to let teams and pools finish loading
        let retries = 0;
        while ((getTeams().length === 0 || getPools().length === 0) && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (matches.length > 0) {
            renderMatchGrid(matches);
        } else {
            const grid = document.getElementById('adminMatchGrid');
            if (grid) grid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">No matches found. Generate a schedule to begin.</p>';
        }
        
        if (typeof renderPublicPools === 'function') renderPublicPools();
    }
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 480; 
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
}

function minutesToTimeStr(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function handleAutoGenerate() {
    const teams = getTeams();
    const poolsList = getPools();
    if (!teams || teams.length === 0) {
        alert("Please assign teams to pools first!");
        return;
    }

    const startTimeInput = document.querySelector('input[type="time"]');
    const incrementSelect = document.querySelector('select'); 
    
    let incrementMins = 60;
    if (incrementSelect) {
        const val = parseInt(incrementSelect.value);
        if (!isNaN(val)) incrementMins = val;
    }

    const poolsMap = {};
    let assignedTeamsCount = 0;
    
    teams.forEach(team => {
        if (team.pool_id) {
            if (!poolsMap[team.pool_id]) poolsMap[team.pool_id] = [];
            poolsMap[team.pool_id].push(team);
            assignedTeamsCount++;
        }
    });

    const sortedPoolIds = Object.keys(poolsMap).sort((idA, idB) => {
        const poolA = poolsList.find(p => p.id === idA)?.name || '';
        const poolB = poolsList.find(p => p.id === idB)?.name || '';
        return poolA.localeCompare(poolB);
    });

    let generatedMatches = [];

    // --- DIRECTOR'S CUSTOM 14-TEAM SCHEDULE (POOL PLAY ONLY) ---
    if (assignedTeamsCount === 14 && sortedPoolIds.length >= 4) {
        const [pA, pB, pC, pD] = sortedPoolIds;
        
        const getSorted = (pid) => poolsMap[pid].sort((a, b) => (parseInt(a.seed) || 99) - (parseInt(b.seed) || 99));
        const teamsA = getSorted(pA);
        const teamsB = getSorted(pB);
        const teamsC = getSorted(pC);
        const teamsD = getSorted(pD);
        
        const startMins = timeToMinutes(startTimeInput ? startTimeInput.value : '08:00');

        const addMatch = (poolId, t1, t2, ref, timeOffset) => {
            generatedMatches.push({
                id: crypto.randomUUID(),
                pool_id: poolId,
                teamA: t1, teamB: t2, ref: ref,
                time: minutesToTimeStr(startMins + timeOffset)
            });
        };

        // POOL A (3 Teams): 8am, 9am, 10am
        addMatch(pA, teamsA[0].id, teamsA[2].id, teamsA[1].id, 0);
        addMatch(pA, teamsA[1].id, teamsA[2].id, teamsA[0].id, incrementMins);
        addMatch(pA, teamsA[0].id, teamsA[1].id, teamsA[2].id, incrementMins * 2);

        // POOL B (4 Teams): 8, 9, 10, 11, and two at 12pm
        addMatch(pB, teamsB[0].id, teamsB[2].id, teamsB[1].id, 0);
        addMatch(pB, teamsB[1].id, teamsB[3].id, teamsB[0].id, incrementMins);
        addMatch(pB, teamsB[0].id, teamsB[3].id, teamsB[2].id, incrementMins * 2);
        addMatch(pB, teamsB[1].id, teamsB[2].id, teamsB[0].id, incrementMins * 3);
        addMatch(pB, teamsB[2].id, teamsB[3].id, teamsB[1].id, incrementMins * 4); // 12pm
        addMatch(pB, teamsB[0].id, teamsB[1].id, teamsB[3].id, incrementMins * 4); // 12pm (Simultaneous)

        // POOL C (4 Teams): 8, 9, 10, 11, and two at 12pm
        addMatch(pC, teamsC[0].id, teamsC[2].id, teamsC[1].id, 0);
        addMatch(pC, teamsC[1].id, teamsC[3].id, teamsC[0].id, incrementMins);
        addMatch(pC, teamsC[0].id, teamsC[3].id, teamsC[2].id, incrementMins * 2);
        addMatch(pC, teamsC[1].id, teamsC[2].id, teamsC[0].id, incrementMins * 3);
        addMatch(pC, teamsC[2].id, teamsC[3].id, teamsC[1].id, incrementMins * 4); // 12pm
        addMatch(pC, teamsC[0].id, teamsC[1].id, teamsC[3].id, incrementMins * 4); // 12pm (Simultaneous)

        // POOL D (3 Teams): 8am, 9am, 10am
        addMatch(pD, teamsD[0].id, teamsD[2].id, teamsD[1].id, 0);
        addMatch(pD, teamsD[1].id, teamsD[2].id, teamsD[0].id, incrementMins);
        addMatch(pD, teamsD[0].id, teamsD[1].id, teamsD[2].id, incrementMins * 2);
        
    } else {
        alert("This auto-generator is currently locked to the 14-team format.");
        return;
    }

    renderMatchGrid(generatedMatches);
}

function renderMatchGrid(matches) {
    const grid = document.getElementById('adminMatchGrid');
    if (!grid) return;

    grid.innerHTML = ''; 
    
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
    grid.style.gap = '15px';
    grid.style.alignItems = 'start'; 

    const allTeams = getTeams();
    const allPools = getPools(); 
    const allStandings = typeof getAllPoolStandings === 'function' ? getAllPoolStandings() : {};

    // Smart resolver to translate placeholders into real team names
    const formatSeedRef = (ref) => {
        if (!ref || !ref.startsWith('seed:')) return null;
        const parts = ref.split(':');
        const poolId = parts[1];
        const rank = parseInt(parts[2], 10);
        
        const pStandings = allStandings[poolId] || [];
        let isComplete = false;
        if (pStandings.length > 0) {
            const expectedMatches = pStandings.length === 3 ? 2 : 3;
            isComplete = pStandings.every(t => t.matchesPlayed >= expectedMatches);
        }
        
        if (isComplete && pStandings[rank - 1]) {
            return pStandings[rank - 1].name;
        }

        const poolName = allPools.find(p => p.id === poolId)?.name || 'Pool';
        const rankStr = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th';
        return `${rankStr} Place ${poolName}`;
    };

    const getTeamOptions = (selectedId) => {
        let options = allTeams.map(t => {
            const seedText = t.seed && t.seed !== 99 ? `(${t.seed}) ` : '';
            return `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${seedText}${t.name}</option>`;
        }).join('');

        // If the selected ID is a placeholder, inject it as a visible option
        if (selectedId && selectedId.startsWith('seed:')) {
            const displayName = formatSeedRef(selectedId);
            options = `<option value="${selectedId}" selected>⚙️ ${displayName} (Auto)</option>` + options;
        }

        return options;
    };

    const matchesByPool = {};
    matches.forEach(match => {
        const pid = match.pool_id || 'unassigned';
        if (!matchesByPool[pid]) matchesByPool[pid] = [];
        matchesByPool[pid].push(match);
    });

    const sortedPoolIds = Object.keys(matchesByPool).sort((idA, idB) => {
        const poolA = allPools.find(p => p.id === idA)?.name || 'Unassigned';
        const poolB = allPools.find(p => p.id === idB)?.name || 'Unassigned';
        return poolA.localeCompare(poolB);
    });

    sortedPoolIds.forEach(poolId => {
        const poolMatches = matchesByPool[poolId];
        poolMatches.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        const poolObj = allPools.find(p => p.id === poolId);
        const poolName = poolObj ? poolObj.name : 'Unassigned';

        const columnDiv = document.createElement('div');
        columnDiv.style.display = 'flex';
        columnDiv.style.flexDirection = 'column';
        columnDiv.style.gap = '10px';
        columnDiv.style.background = 'var(--surface-dark, #1e293b)';
        columnDiv.style.padding = '15px';
        columnDiv.style.borderRadius = '8px';
        columnDiv.style.border = '1px solid var(--border-color, #334155)';

        const poolHeader = document.createElement('div');
        poolHeader.innerHTML = `<h3 style="margin: 0 0 10px 0; color: var(--accent-orange); text-align: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">${poolName}</h3>`;
        columnDiv.appendChild(poolHeader);

        poolMatches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.dataset.matchId = match.id || ''; 
            matchCard.dataset.poolId = match.pool_id || ''; 
            
            matchCard.style.width = '100%';
            matchCard.style.boxSizing = 'border-box';
            matchCard.style.padding = '10px';
            matchCard.style.background = 'rgba(255,255,255,0.02)';
            matchCard.style.borderRadius = '6px';
            matchCard.style.border = '1px solid rgba(255,255,255,0.05)';

            matchCard.innerHTML = `
                <div style="display: flex; margin-bottom: 8px;">
                    <input type="time" class="match-time" value="${match.time || ''}" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--background-dark); color: white; font-size: 0.85rem;">
                </div>

                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <select class="team1-select" style="flex: 1; min-width: 0; padding: 5px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--surface-light); color: white; font-size: 0.8rem;">
                        <option value="">Team 1...</option>
                        ${getTeamOptions(match.teamA)}
                    </select>
                    <span style="color: var(--text-secondary); font-size: 0.75rem; font-weight: bold;">vs</span>
                    <select class="team2-select" style="flex: 1; min-width: 0; padding: 5px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--surface-light); color: white; font-size: 0.8rem;">
                        <option value="">Team 2...</option>
                        ${getTeamOptions(match.teamB)}
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.75rem; color: #94A3B8; font-weight: bold;">Ref:</span>
                    <select class="ref-select" style="flex: 1; min-width: 0; padding: 5px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--surface-light); color: white; font-size: 0.8rem;">
                        <option value="">Select Ref...</option>
                        ${getTeamOptions(match.ref)}
                    </select>
                </div>
            `;

            columnDiv.appendChild(matchCard);
        });

        grid.appendChild(columnDiv);
    });
}

async function saveSchedule() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const grid = document.getElementById('adminMatchGrid');
    const matchCards = grid.querySelectorAll('.match-card');
    
    const updates = [];
    const activeIds = [];

    matchCards.forEach(card => {
        const t1 = card.querySelector('.team1-select').value;
        const t2 = card.querySelector('.team2-select').value;
        
        if (t1 && t2) {
            const matchData = {
                tournament_id: tournamentId,
                teamA: t1,
                teamB: t2,
                ref: card.querySelector('.ref-select').value || null,
                time: card.querySelector('.match-time').value || null, 
                pool_id: card.dataset.poolId || null 
            };

            const dbId = card.dataset.matchId;
            if (dbId && dbId.length > 10) { 
                matchData.id = dbId;
                activeIds.push(dbId);
            }

            updates.push(matchData);
        }
    });

    if (updates.length === 0) {
        alert("No matches on screen to save. Use 'Clear Schedule' to completely empty the database.");
        return;
    }

    const { data: existingMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId);
        
    if (existingMatches) {
        const toDelete = existingMatches.map(m => m.id).filter(id => !activeIds.includes(id));
        if (toDelete.length > 0) {
            await supabase.from('matches').delete().in('id', toDelete);
        }
    }

    const { error } = await supabase.from('matches').upsert(updates);

    if (error) {
        alert("Error saving schedule: " + error.message);
    } else {
        alert("Schedule saved successfully!");
        loadSchedule(); 
    }
}

async function handleClearSchedule() {
    if (!confirm("Are you sure you want to delete ALL matches for this tournament? This cannot be undone.")) return;
    
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { error } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId);

    if (error) {
        alert("Error clearing schedule: " + error.message);
    } else {
        alert("Schedule completely cleared!");
        document.getElementById('adminMatchGrid').innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">Schedule empty. Generate matches to begin.</p>';
        if (typeof setMatches === 'function') setMatches([]);
        if (typeof renderPublicPools === 'function') renderPublicPools();
    }
}