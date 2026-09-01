// state.js

// This object is private to this file
const state = {
    tournamentId: null,
    tournamentData: null,
    teams: [],
    isAdminAuthenticated: false,
    currentView: 'landing' // 'landing', 'pools', 'brackets', etc.
};

// --- Getters ---
export const getTournamentId = () => state.tournamentId;
export const getTournamentData = () => state.tournamentData;
export const getTeams = () => state.teams;
export const isAdmin = () => state.isAdminAuthenticated;
export const getCurrentView = () => state.currentView;

// --- Setters ---
export const setTournamentId = (id) => {
    state.tournamentId = id;
};

export const setTournamentData = (data) => {
    state.tournamentData = data;
};

export const setTeams = (teamsArray) => {
    state.teams = teamsArray;
};

export const setAdminAuth = (status) => {
    state.isAdminAuthenticated = status;
};

export const setCurrentView = (viewName) => {
    state.currentView = viewName;
};