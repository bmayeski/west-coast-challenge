import { formatTime } from './utils.js';
// Import the Panzoom library directly via CDN for instant, native ES Module support
import Panzoom from 'https://cdn.jsdelivr.net/npm/@panzoom/panzoom@4.5.1/dist/panzoom.es.js';

let panzoomInstance = null;

export function initBracketPanZoom() {
  const bracketWindow = document.getElementById('bracket-window');
  const canvas = document.getElementById('bracket-canvas');
  
  if (!bracketWindow || !canvas) return;

  // 1. Mobile Secret Sauce: Prevent the browser from trying to scroll the page when swiping the bracket
  bracketWindow.style.touchAction = 'none';
  
  // 2. Desktop Secret Sauce: Strip away the old CSS transition to remove the "laggy" dragging feel
  canvas.style.transition = 'none';

  // 3. Initialize the silky-smooth Panzoom engine
  panzoomInstance = Panzoom(canvas, {
    maxScale: 2.5,
    minScale: 0.3,
    step: 0.15, // Makes the desktop scroll wheel zoom a bit more responsive
    cursor: 'grab'
  });

  // 4. Hook up desktop mouse-wheel zooming
  bracketWindow.addEventListener('wheel', panzoomInstance.zoomWithWheel);
}

export function renderBracket(bracketData) {
  const canvas = document.getElementById('bracket-canvas');
  if (!canvas || !bracketData || !bracketData.matches) return;

  const roundsMap = {};
  bracketData.matches.forEach(match => {
      const roundName = match.type || 'Matches';
      if (!roundsMap[roundName]) roundsMap[roundName] = [];
      roundsMap[roundName].push(match);
  });

  const roundOrder = ["Seeding", "Quarterfinals", "Semifinals", "Finals"];
  const sortedRoundNames = Object.keys(roundsMap).sort((a, b) => {
      let indexA = roundOrder.findIndex(r => a.includes(r));
      let indexB = roundOrder.findIndex(r => b.includes(r));
      if (indexA === -1) indexA = 99;
      if (indexB === -1) indexB = 99;
      return indexA - indexB;
  });

  if (bracketData.matches.length === 0) {
      canvas.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">No bracket matches scheduled.</p>`;
      return;
  }

  let html = `<div style="display: grid; grid-template-columns: repeat(${sortedRoundNames.length}, minmax(260px, 1fr)); gap: 50px; padding: 20px; align-items: center; min-height: 700px;">`;

  sortedRoundNames.forEach((roundName, colIndex) => {
      html += `
        <div class="bracket-round" style="display: flex; flex-direction: column; height: 100%; justify-content: space-around;">
          <div style="text-align: center; color: var(--accent-orange); font-weight: 800; margin-bottom: 20px; letter-spacing: 1px; font-size: 0.9rem; text-transform: uppercase;">
            ${roundName}
          </div>
          <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: space-around; gap: 30px;">
      `;

      let matches = roundsMap[roundName];
      matches.sort((a, b) => {
          return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true, sensitivity: 'base' });
      });

      matches.forEach(match => {
          let isComplete = match.status === 'Complete' || match.status === 'Final';
          let opacity = isComplete ? '1' : '0.9';

          let setsA = 0; let setsB = 0;
          if (match.s1A !== "" && match.s1B !== "") { parseInt(match.s1A) > parseInt(match.s1B) ? setsA++ : setsB++; }
          if (match.s2A !== "" && match.s2B !== "") { parseInt(match.s2A) > parseInt(match.s2B) ? setsA++ : setsB++; }
          
          if (setsA < 2 && setsB < 2) {
              if (match.s3A !== "" && match.s3B !== "") { parseInt(match.s3A) > parseInt(match.s3B) ? setsA++ : setsB++; }
          }

          let teamAWon = isComplete && setsA > setsB;
          let teamBWon = isComplete && setsB > setsA;

          let teamAClass = teamAWon ? 'border: 1px solid var(--accent-orange); background: rgba(255, 95, 0, 0.05);' : 'border: 1px solid transparent;';
          let teamBClass = teamBWon ? 'border: 1px solid var(--accent-orange); background: rgba(255, 95, 0, 0.05);' : 'border: 1px solid transparent;';

          let scoresText = [];
          if (match.s1A !== "" && match.s1B !== "") scoresText.push(`${match.s1A}-${match.s1B}`);
          if (match.s2A !== "" && match.s2B !== "") scoresText.push(`${match.s2A}-${match.s2B}`);
          
          let firstTwoA = 0; let firstTwoB = 0;
          if (match.s1A !== "" && match.s1B !== "") { parseInt(match.s1A) > parseInt(match.s1B) ? firstTwoA++ : firstTwoB++; }
          if (match.s2A !== "" && match.s2B !== "") { parseInt(match.s2A) > parseInt(match.s2B) ? firstTwoA++ : firstTwoB++; }
          
          if (firstTwoA < 2 && firstTwoB < 2 && match.s3A !== "" && match.s3B !== "") {
              scoresText.push(`${match.s3A}-${match.s3B}`);
          }
          let scoreDisplay = scoresText.length > 0 ? scoresText.join(' | ') : '-';

          html += `
            <div class="bracket-match" style="opacity: ${opacity}; background: var(--surface-dark); padding: 12px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 100%; position: relative; border: 1px solid var(--border-color);">
               
               <div style="font-size: 0.75rem; display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
                   <span style="color: var(--accent-orange); border: 1px solid var(--accent-orange); padding: 2px 8px; border-radius: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                       🕒 ${formatTime(match.time)}
                   </span>
                   <span style="color: var(--text-secondary); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.05);">
                       Match ${match.id}
                   </span>
               </div>
               
               <div style="${teamAClass} display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; margin-bottom: 4px;">
                  <span style="color: var(--text-primary); font-weight: 600;">${match.teamA || 'TBD'}</span>
                  <span style="color: var(--text-primary); font-weight: bold; font-size: 1.1rem;">${match.s1A !== "" ? setsA : '-'}</span>
               </div>

               <div style="${teamBClass} display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px;">
                  <span style="color: var(--text-primary); font-weight: 600;">${match.teamB || 'TBD'}</span>
                  <span style="color: var(--text-primary); font-weight: bold; font-size: 1.1rem;">${match.s1B !== "" ? setsB : '-'}</span>
               </div>

               <div style="border-top: 1px dashed var(--border-color); margin-top: 12px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary);">
                   <span>Ref: <span style="color: var(--accent-orange); font-weight: bold;">${match.ref || '-'}</span></span>
                   <span style="color: var(--text-primary);">${scoreDisplay}</span>
               </div>
            </div>
          `;
      });
      html += `</div></div>`;
  });
  
  html += `</div>`;
  canvas.innerHTML = html;
}