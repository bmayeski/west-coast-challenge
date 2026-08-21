let br_scale = 0.8; 
let br_pointX = 0; 
let br_pointY = 0; 
let br_startX = 0; 
let br_startY = 0; 
let br_panning = false;

export function setBracketTransform() {
  const canvas = document.getElementById('bracket-canvas');
  if (canvas) {
    canvas.style.transform = `translate(${br_pointX}px, ${br_pointY}px) scale(${br_scale})`;
  }
}

export function initBracketPanZoom() {
  const bracketWindow = document.getElementById('bracket-window');
  if (!bracketWindow) return;

  bracketWindow.style.cursor = 'grab';

  bracketWindow.addEventListener('mousedown', e => {
    if (e.target.closest('.bracket-match') || e.target.closest('button') || e.target.closest('select')) return;
    br_panning = true;
    br_startX = e.clientX - br_pointX;
    br_startY = e.clientY - br_pointY;
    bracketWindow.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!br_panning) return;
    e.preventDefault(); 
    br_pointX = e.clientX - br_startX;
    br_pointY = e.clientY - br_startY;
    setBracketTransform();
  });

  window.addEventListener('mouseup', () => {
    br_panning = false;
    if (bracketWindow) bracketWindow.style.cursor = 'grab';
  });

  bracketWindow.addEventListener('touchstart', e => {
    if (e.target.closest('.bracket-match') || e.target.closest('button') || e.target.closest('select')) return;
    if (e.touches.length === 1) {
      br_panning = true;
      br_startX = e.touches[0].clientX - br_pointX;
      br_startY = e.touches[0].clientY - br_pointY;
    }
  }, { passive: false });

  bracketWindow.addEventListener('touchmove', e => {
    if (!br_panning || e.touches.length !== 1) return;
    e.preventDefault(); 
    br_pointX = e.touches[0].clientX - br_startX;
    br_pointY = e.touches[0].clientY - br_startY;
    setBracketTransform();
  }, { passive: false });

  window.addEventListener('touchend', () => {
    br_panning = false;
  });

  bracketWindow.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = bracketWindow.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xs = (mouseX - br_pointX) / br_scale;
    const ys = (mouseY - br_pointY) / br_scale;

    const delta = e.deltaY || -e.wheelDelta;
    if (delta > 0) {
      br_scale /= 1.1; 
    } else {
      br_scale *= 1.1; 
    }
    
    br_scale = Math.max(0.3, Math.min(br_scale, 2.5));

    br_pointX = mouseX - xs * br_scale;
    br_pointY = mouseY - ys * br_scale;
    setBracketTransform();
  }, { passive: false });
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

  // Use a synchronized CSS Grid layout for the tournament tree columns
  let html = `<div style="display: grid; grid-template-columns: repeat(${sortedRoundNames.length}, minmax(220px, 1fr)); gap: 50px; padding: 20px; align-items: center; min-height: 700px;">`;

  sortedRoundNames.forEach((roundName, colIndex) => {
      html += `
        <div class="bracket-round" style="display: flex; flex-direction: column; height: 100%; justify-content: space-around;">
          <div style="text-align: center; color: var(--accent-orange); font-weight: bold; margin-bottom: 20px; letter-spacing: 1px; font-size: 0.85rem; text-transform: uppercase;">
            ${roundName}
          </div>
          <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: space-around; gap: 20px;">
      `;

      let matches = roundsMap[roundName];
      matches.sort((a, b) => {
          return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true, sensitivity: 'base' });
      });

      matches.forEach(match => {
          let isComplete = match.status === 'Complete' || match.status === 'Final';
          let borderHighlight = isComplete ? `border-left: 4px solid var(--accent-orange);` : `border-left: 4px solid var(--border-color);`;
          let opacity = isComplete ? '1' : '0.8';

          html += `
            <div class="bracket-match" style="${borderHighlight} opacity: ${opacity}; background: var(--surface-dark); padding: 12px; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 100%; position: relative;">
               <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 8px; display: flex; justify-content: space-between;">
                   <span>Match ${match.id}</span>
                   <span style="background: var(--surface-lighter); padding: 2px 6px; border-radius: 4px;">${match.status || 'Pending'}</span>
               </div>
               <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                  <span style="color: var(--text-primary); font-weight: 600;">${match.teamA || 'TBD'}</span>
                  <span style="color: var(--text-secondary);">${match.s1A || '-'}</span>
               </div>
               <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                  <span style="color: var(--text-primary); font-weight: 600;">${match.teamB || 'TBD'}</span>
                  <span style="color: var(--text-secondary);">${match.s1B || '-'}</span>
               </div>
            </div>
          `;
      });

      html += `</div></div>`;
  });
  
  html += `</div>`;
  canvas.innerHTML = html;
}