export function openScoreModal(match) {
  document.getElementById('modalMatchId').value = match.id;
  document.getElementById('modalMatchTitle').innerText = `Match ${match.id || ''}`;
  document.getElementById('modalMatchTeams').innerText = `${match.teamA} vs ${match.teamB}`;
  document.getElementById('modalTeamAName').innerText = match.teamA;
  document.getElementById('modalTeamBName').innerText = match.teamB;

  document.getElementById('modalS1A').value = match.s1A || '';
  document.getElementById('modalS1B').value = match.s1B || '';
  document.getElementById('modalS2A').value = match.s2A || '';
  document.getElementById('modalS2B').value = match.s2B || '';
  document.getElementById('modalS3A').value = match.s3A || '';
  document.getElementById('modalS3B').value = match.s3B || '';
  document.getElementById('modalStatus').value = match.status || 'Complete';

  document.getElementById('scoreModal').style.display = 'flex';
}

export function closeScoreModal() {
  document.getElementById('scoreModal').style.display = 'none';
}