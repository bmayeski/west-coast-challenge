export function getSiteColor(siteName) {
  if (!siteName) return 'var(--accent-orange)';
  const site = siteName.toLowerCase();
  if (site.includes('valhalla')) return '#FF5F00';
  if (site.includes('granite')) return '#3F98CC'; 
  if (site.includes('christian')) return '#BF2A39';
  return 'var(--accent-orange)'; 
}

export function getScoreStyle(score1, score2) {
  const s1 = parseInt(score1);
  const s2 = parseInt(score2);
  if (!isNaN(s1) && !isNaN(s2)) {
    if (s1 > s2) return "color: var(--accent-orange); font-weight: 600;";
    if (s1 < s2) return "color: var(--text-secondary); font-weight: normal;";
  }
  return "color: var(--text-primary); font-weight: 500;"; 
}

export function lightenColor(color, percent) {
  if (!color || !color.includes('#')) return '#F8FAFC';
  const num = parseInt(color.replace('#', ''), 16),
        amt = Math.round(2.55 * (percent * 100)),
        R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
}

export function formatTime(timeString) {
  if (!timeString || timeString === 'TBD') return 'TBD';
  
  // If it somehow already has AM/PM, just return it safely
  if (timeString.toLowerCase().includes('m')) return timeString;

  // Split "16:00" or "16:00:00" into hours and minutes
  const [hourStr, minuteStr] = timeString.split(':');
  if (!hourStr || !minuteStr) return timeString;
  
  let hours = parseInt(hourStr, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours || 12; // If hour is 0 (midnight), change it to 12
  
  return `${hours}:${minuteStr} ${ampm}`;
}