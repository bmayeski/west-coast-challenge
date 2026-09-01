// adminScores.js
import { supabase } from './supabaseClient.js';
import { loadSchedule } from './adminSchedule.js'; // Refreshes grid AND live-syncs public view

export function initScores() {
    // ONE global listener for everything
    document.addEventListener('click', (e) => {
        
        // 1. OPEN MODAL (Clicking "Edit Scores")
        const scoreBtn = e.target.closest('.edit-score-btn');
        if (scoreBtn) {
            const matchCard = scoreBtn.closest('.match-card') || scoreBtn.closest('.data-card');
            if (!matchCard) return;

            const matchId = matchCard.dataset.matchId || scoreBtn.dataset.id;
            const team1Name = matchCard.querySelector('.team1-select')?.selectedOptions[0]?.text || "Team A";
            const team2Name = matchCard.querySelector('.team2-select')?.selectedOptions[0]?.text || "Team B";

            openScoreModal(matchId, team1Name, team2Name);
            return;
        }

        // 2. SAVE SCORES
        if (e.target.closest('#saveScoresBtn')) {
            saveScores();
            return;
        }

        // 3. CLOSE MODAL
        if (e.target.closest('#closeScoreModalBtn')) {
            closeScoreModal();
            return;
        }

        // 4. CLEAR SCORES
        if (e.target.closest('#deleteScoresBtn')) {
            clearScores();
            return;
        }
    });
}

function openScoreModal(matchId, team1Name, team2Name) {
    if (!matchId || matchId.length < 10) {
        alert("Please save the schedule first before entering scores.");
        return;
    }

    console.log("Opening modal for match ID:", matchId);

    const matchupText = document.getElementById('scoreModalMatchup');
    if (matchupText) {
        matchupText.textContent = `${team1Name} vs ${team2Name}`;
    }

    // Write the ID securely into the HTML hidden input
    const hiddenId = document.getElementById('scoreModalMatchId');
    if (hiddenId) {
        hiddenId.value = matchId;
    }

    // Clear old inputs
    const inputs = document.querySelectorAll('.score-input');
    inputs.forEach(input => input.value = '');

    // Uncheck the 'Completed' box by default when opening
    const completeBox = document.getElementById('matchCompleteCheckbox');
    if (completeBox) completeBox.checked = false;

    // Show the modal
    const modal = document.getElementById('editScoreModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeScoreModal() {
    const modal = document.getElementById('editScoreModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveScores() {
    // Read the ID directly from the hidden input
    const matchId = document.getElementById('scoreModalMatchId')?.value;
    
    if (!matchId) {
        console.error("Save failed: No match ID found in hidden input.");
        return;
    }

    console.log("Saving scores for match:", matchId);

    const s1A = parseInt(document.getElementById('s1A')?.value);
    const s1B = parseInt(document.getElementById('s1B')?.value);
    const s2A = parseInt(document.getElementById('s2A')?.value);
    const s2B = parseInt(document.getElementById('s2B')?.value);
    const s3A = parseInt(document.getElementById('s3A')?.value);
    const s3B = parseInt(document.getElementById('s3B')?.value);

    const isComplete = document.getElementById('matchCompleteCheckbox')?.checked;

    const matchUpdate = {
        s1A: isNaN(s1A) ? null : s1A,
        s1B: isNaN(s1B) ? null : s1B,
        s2A: isNaN(s2A) ? null : s2A,
        s2B: isNaN(s2B) ? null : s2B,
        s3A: isNaN(s3A) ? null : s3A,
        s3B: isNaN(s3B) ? null : s3B,
        status: isComplete ? 'completed' : 'scheduled' 
    };

    const { error } = await supabase
        .from('matches')
        .update(matchUpdate)
        .eq('id', matchId);

    if (error) {
        console.error("Supabase Save Error:", error);
        alert("Error saving scores: " + error.message);
    } else {
        closeScoreModal();
        if (typeof loadSchedule === 'function') loadSchedule(); 
        
        // FORCES THE ADMIN UI TO VISUALLY REFRESH INSTANTLY
        document.getElementById('refreshScoresBtn')?.click();
    }
}

async function clearScores() {
    // Read the ID directly from the hidden input
    const matchId = document.getElementById('scoreModalMatchId')?.value;
    console.log("Clear Scores clicked for match:", matchId);

    if (!matchId) {
        console.error("Clear failed: No match ID found in hidden input.");
        return;
    }

    // Safety check so you don't accidentally wipe a game
    if (!confirm("Are you sure you want to completely clear the scores for this match?")) {
        return; 
    }

    const wipedData = {
        s1A: null, s1B: null,
        s2A: null, s2B: null,
        s3A: null, s3B: null,
        status: 'scheduled'
    };

    console.log("Sending wipe command to Supabase...");

    const { error } = await supabase
        .from('matches')
        .update(wipedData)
        .eq('id', matchId);

    if (error) {
        console.error("Supabase Clear Error:", error);
        alert("Error clearing scores: " + error.message);
    } else {
        console.log("Match cleared successfully!");
        closeScoreModal();
        if (typeof loadSchedule === 'function') loadSchedule(); 
        
        // FORCES THE ADMIN UI TO VISUALLY REFRESH INSTANTLY
        document.getElementById('refreshScoresBtn')?.click();
    }
}