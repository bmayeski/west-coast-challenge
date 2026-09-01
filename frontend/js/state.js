// This object is private to this file
const state = {
    tournamentId: null,
    tournamentData: null,
    pools: [],     // NEW: Added pools state
    teams: [],
    matches: [],   // NEW: Added matches state
    isAdminAuthenticated: false,
    currentView: 'landing' 
};

// --- Getters ---
export const getTournamentId = () => state.tournamentId;
export const getTournamentData = () => state.tournamentData;
export const getPools = () => state.pools;       // NEW
export const getTeams = () => state.teams;
export const getMatches = () => state.matches;   // NEW
export const isAdmin = () => state.isAdminAuthenticated;
export const getCurrentView = () => state.currentView;

// --- Setters ---
export const setTournamentId = (id) => {
    state.tournamentId = id;
};

export const setTournamentData = (data) => {
    state.tournamentData = data;
};

export const setPools = (poolsArray) => {        // NEW
    state.pools = poolsArray;
};

export const setTeams = (teamsArray) => {
    state.teams = teamsArray;
};

export const setMatches = (matchesArray) => {    // NEW
    state.matches = matchesArray;
};

export const setAdminAuth = (status) => {
    state.isAdminAuthenticated = status;
};

export const setCurrentView = (viewName) => {
    state.currentView = viewName;
};