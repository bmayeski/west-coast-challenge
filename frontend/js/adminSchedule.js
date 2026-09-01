// adminSchedule.js
import { supabase } from './supabaseClient.js';
import { getTournamentId, getTeams, getPools, setMatches } from './state.js'; 
import { renderPublicPools } from './uiPublic.js';

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
    teams.forEach(team => {
        if (team.pool_id) {
            if (!poolsMap[team.pool_id]) poolsMap[team.pool_id] = [];
            poolsMap[team.pool_id].push(team);
        }
    });

    const sortedPoolIds = Object.keys(poolsMap).sort((idA, idB) => {
        const poolA = poolsList.find(p => p.id === idA)?.name || '';
        const poolB = poolsList.find(p => p.id === idB)?.name || '';
        return poolA.localeCompare(poolB);
    });

    let generatedMatches = [];

    sortedPoolIds.forEach(poolId => {
        const poolTeams = poolsMap[poolId];
        
        poolTeams.sort((a, b) => {
            const seedA = parseInt(a.seed, 10) || 99;
            const seedB = parseInt(b.seed, 10) || 99;
            return seedA - seedB;
        });
        
        let currentMinutes = timeToMinutes(startTimeInput ? startTimeInput.value : '08:00');
        const template = SCHEDULE_TEMPLATES[poolTeams.length];
        
        if (template) {
            template.forEach(matchInfo => {
                const teamA = poolTeams[matchInfo[0]];
                const teamB = poolTeams[matchInfo[1]];
                const ref = poolTeams[matchInfo[2]];

                if (teamA && teamB) {
                    generatedMatches.push({
                        id: crypto.randomUUID(), 
                        pool_id: poolId, 
                        teamA: teamA.id, 
                        teamB: teamB.id, 
                        ref: ref ? ref.id : null, 
                        time: minutesToTimeStr(currentMinutes) 
                    });
                    currentMinutes += incrementMins;
                }
            });
        } else {
            for (let i = 0; i < poolTeams.length; i++) {
                for (let j = i + 1; j < poolTeams.length; j++) {
                    const refTeam = poolTeams.find(t => t.id !== poolTeams[i].id && t.id !== poolTeams[j].id);
                    generatedMatches.push({
                        id: crypto.randomUUID(), 
                        pool_id: poolId, 
                        teamA: poolTeams[i].id, 
                        teamB: poolTeams[j].id, 
                        ref: refTeam ? refTeam.id : null, 
                        time: minutesToTimeStr(currentMinutes) 
                    });
                    currentMinutes += incrementMins;
                }
            }
        }
    });

    if (generatedMatches.length === 0) {
        alert("Not enough teams assigned to pools to generate matches.");
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

    const getTeamOptions = (selectedId) => {
        return allTeams.map(t => {
            const seedText = t.seed ? `(${t.seed}) ` : '';
            return `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${seedText}${t.name}</option>`;
        }).join('');
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