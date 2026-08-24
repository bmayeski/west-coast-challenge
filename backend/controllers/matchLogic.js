import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export async function routeBracketMatch(matchId, s1a, s1b, s2a, s2b, s3a, s3b, teamA_Id, teamB_Id) {
    // 1. Calculate Winner and Loser
    let setsA = 0; let setsB = 0;
    
    if (s1a !== "" && s1b !== "") { parseInt(s1a) > parseInt(s1b) ? setsA++ : setsB++; }
    if (s2a !== "" && s2b !== "") { parseInt(s2a) > parseInt(s2b) ? setsA++ : setsB++; }
    if (s3a !== "" && s3b !== "") { parseInt(s3a) > parseInt(s3b) ? setsA++ : setsB++; }
    
    if (setsA === setsB) return; // No winner yet

    const winnerId = setsA > setsB ? teamA_Id : teamB_Id;
    const loserId = setsA > setsB ? teamB_Id : teamA_Id;

    // 2. THE CORRECTED ROUTING MAP (Includes the G2, G4, S2, S4 Seeding Fixes)
    const routingMap = {
        // GOLD
        'GS1': { winMatch: 'G1', winSlot: 'team_a_id', loseMatch: 'G4', loseSlot: 'team_b_id' },
        'GS2': { winMatch: 'G3', winSlot: 'team_a_id', loseMatch: 'G2', loseSlot: 'team_b_id' },
        'GS3': { winMatch: 'G2', winSlot: 'team_a_id', loseMatch: 'G3', loseSlot: 'team_b_id' },
        'GS4': { winMatch: 'G4', winSlot: 'team_a_id', loseMatch: 'G1', loseSlot: 'team_b_id' },
        
        'G1': { winMatch: 'G5', winSlot: 'team_a_id' },
        'G2': { winMatch: 'G5', winSlot: 'team_b_id' },
        'G3': { winMatch: 'G6', winSlot: 'team_a_id' },
        'G4': { winMatch: 'G6', winSlot: 'team_b_id' },
        'G5': { winMatch: 'G7', winSlot: 'team_a_id' },
        'G6': { winMatch: 'G7', winSlot: 'team_b_id' },

        // SILVER
        'SS1': { winMatch: 'S1', winSlot: 'team_a_id', loseMatch: 'S4', loseSlot: 'team_b_id' },
        'SS2': { winMatch: 'S3', winSlot: 'team_a_id', loseMatch: 'S2', loseSlot: 'team_b_id' },
        'SS3': { winMatch: 'S2', winSlot: 'team_a_id', loseMatch: 'S3', loseSlot: 'team_b_id' },
        'SS4': { winMatch: 'S4', winSlot: 'team_a_id', loseMatch: 'S1', loseSlot: 'team_b_id' },
        
        'S1': { winMatch: 'S5', winSlot: 'team_a_id' },
        'S2': { winMatch: 'S5', winSlot: 'team_b_id' },
        'S3': { winMatch: 'S6', winSlot: 'team_a_id' },
        'S4': { winMatch: 'S6', winSlot: 'team_b_id' },
        'S5': { winMatch: 'S7', winSlot: 'team_a_id' },
        'S6': { winMatch: 'S7', winSlot: 'team_b_id' },
    };

    const route = routingMap[matchId];
    if (!route) return; // Not a seeding/routing match

    // 3. Update Supabase with the advancing teams
    if (route.winMatch) {
        const updateObj = {}; updateObj[route.winSlot] = winnerId;
        await supabase.from('matches').update(updateObj).eq('id', route.winMatch);
    }
    if (route.loseMatch) {
        const updateObj = {}; updateObj[route.loseSlot] = loserId;
        await supabase.from('matches').update(updateObj).eq('id', route.loseMatch);
    }
}