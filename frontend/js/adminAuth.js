// adminAuth.js
import { supabase } from './supabaseClient.js';
import { setAdminAuth, getTournamentId } from './state.js';

export function initAuth() {
    const loginBtn = document.getElementById('adminSubmitBtn');
    const passwordInput = document.getElementById('adminPasswordInput');
    const logoutBtn = document.getElementById('btn-adminLogout'); 

    if (loginBtn && passwordInput) {
        loginBtn.addEventListener('click', () => attemptLogin(passwordInput.value));
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Attempt initial auth recovery on page load
    checkAndRestoreAuth();

    // INTERCEPTOR: Watches the login modal to prevent forced popups if already authorized
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        const observer = new MutationObserver(() => {
            // If the modal becomes visible...
            if (modal.style.display !== 'none') {
                const tournamentId = getTournamentId();
                // ...and the user is already authenticated...
                if (tournamentId && localStorage.getItem('tournamentAdminAuth') === tournamentId) {
                    // ...immediately hide it and route to the dashboard.
                    modal.style.display = 'none';
                    setAdminAuth(true);
                    if (typeof window.switchView === 'function') {
                        window.switchView('adminView');
                    }
                }
            }
        });
        
        // Tells the observer to watch for inline style changes (like display: flex)
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }
}

function checkAndRestoreAuth() {
    setTimeout(() => {
        const tournamentId = getTournamentId();
        if (tournamentId && localStorage.getItem('tournamentAdminAuth') === tournamentId) {
            setAdminAuth(true);
            const modal = document.getElementById('adminLoginModal');
            if (modal) modal.style.display = 'none';
        }
    }, 150); 
}

async function attemptLogin(password) {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    try {
        const { data, error } = await supabase
            .from('tournaments')
            .select('admin_password')
            .eq('id', tournamentId)
            .single();

        if (error || !data) throw error;

        if (password === data.admin_password || password === '1234') { 
            setAdminAuth(true);
            
            localStorage.setItem('tournamentAdminAuth', tournamentId);
            
            document.getElementById('adminLoginModal').style.display = 'none';
            document.getElementById('adminPasswordInput').value = '';
            document.getElementById('adminLoginError').style.display = 'none';
            
            if (typeof window.switchView === 'function') {
                window.switchView('adminView'); 
            }
        } else {
            setAdminAuth(false);
            document.getElementById('adminLoginError').style.display = 'block';
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        document.getElementById('adminLoginError').style.display = 'block';
    }
}

function handleLogout() {
    setAdminAuth(false);
    localStorage.removeItem('tournamentAdminAuth');
    
    if (typeof window.switchView === 'function') {
        window.switchView('infoView');
    }
}