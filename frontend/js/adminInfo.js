// adminInfo.js
import { supabase } from './supabaseClient.js';
// NEW: Imported state updaters and the public renderer
import { getTournamentId, getTournamentData, setTournamentData } from './state.js';
import { renderPublicInfo } from './uiPublic.js';

let quillInstances = {};
let quillSubInstances = {};
let quillAlertInstances = {};
let sectionCounter = 0;

export function initEditor() {
    const container = document.getElementById('editor');
    const saveBtn = document.getElementById('saveInfoBtn');

    if (!container) return;
    
    container.outerHTML = `
        <div id="infoSectionsContainer" style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px;"></div>
        <button id="addInfoSectionBtn" class="btn" style="width: 100%; background: var(--surface-light); color: var(--text-primary); border: 1px dashed var(--border-color); padding: 10px; margin-bottom: 20px; cursor: pointer;">
            + Add New Info Section
        </button>
    `;

    document.getElementById('addInfoSectionBtn')?.addEventListener('click', () => addSection());
    if (saveBtn) saveBtn.addEventListener('click', saveTournamentInfo);
}

export async function loadTournamentInfo() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const { data, error } = await supabase
        .from('tournaments')
        .select('info_data')
        .eq('id', tournamentId)
        .single();

    if (error) {
        console.error("Error loading tournament info:", error);
        return;
    }

    // FIX: Update the global state so the public view actually sees the new data!
    const currentData = getTournamentData();
    if (currentData) {
        currentData.info_data = data.info_data;
        setTournamentData(currentData);
    }

    const container = document.getElementById('infoSectionsContainer');
    if (container) container.innerHTML = '';
    
    quillInstances = {};
    quillSubInstances = {};
    quillAlertInstances = {};

    if (data && Array.isArray(data.info_data) && data.info_data.length > 0) {
        data.info_data.forEach(sec => addSection(sec.icon, sec.title, sec.content, sec.subContent, sec.alertContent));
    } else {
        addSection('📍', 'Tournament Info', typeof data?.info_data === 'string' ? data.info_data : '');
    }
    
    // FIX: Directly call the imported public renderer
    renderPublicInfo();
}

function addSection(icon = '📌', title = '', content = '', subContent = '', alertContent = '') {
    const container = document.getElementById('infoSectionsContainer');
    if (!container) return;

    const sectionId = 'section_' + (++sectionCounter);
    
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'info-section-card data-card';
    sectionDiv.style.cssText = 'background: var(--surface-dark); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px;';
    sectionDiv.dataset.id = sectionId;

    sectionDiv.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="section-icon" value="${icon}" placeholder="Icon" style="width: 50px; text-align: center; background: var(--background-dark); border: 1px solid var(--border-color); color: white; border-radius: 4px; padding: 8px;">
            <input type="text" class="section-title" value="${title}" placeholder="Section Title" style="flex-grow: 1; background: var(--background-dark); border: 1px solid var(--border-color); color: white; border-radius: 4px; padding: 8px;">
            <button class="remove-section-btn" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; padding: 0 15px; cursor: pointer; font-weight: bold;" title="Delete Section">X</button>
        </div>
        
        <div id="quill_${sectionId}" style="height: 100px; background: white; color: black; border-radius: 4px; margin-bottom: 12px;"></div>
        
        <!-- Action Buttons to Toggle Optional Boxes -->
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button type="button" class="toggle-sub-btn btn" style="font-size: 0.75rem; background: var(--surface-light); color: var(--text-primary); border: 1px solid var(--border-color); padding: 4px 10px; cursor: pointer;">
                + Add Sub-section Box
            </button>
            <button type="button" class="toggle-alert-btn btn" style="font-size: 0.75rem; background: var(--surface-light); color: var(--text-primary); border: 1px solid var(--border-color); padding: 4px 10px; cursor: pointer;">
                + Add Alert Banner
            </button>
        </div>

        <div class="sub-wrapper" style="display: ${subContent ? 'block' : 'none'}; margin-top: 10px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="color: var(--accent-orange); font-size: 0.75rem; font-weight: bold;">Sub-section Box</label>
                <button type="button" class="remove-sub-btn" style="background: transparent; color: #ef4444; border: none; cursor: pointer; font-size: 0.75rem;">Remove Box</button>
            </div>
            <div id="quill_sub_${sectionId}" style="height: 75px; background: #f1f5f9; color: black; border-radius: 4px; border-left: 4px solid var(--accent-orange);"></div>
        </div>

        <div class="alert-wrapper" style="display: ${alertContent ? 'block' : 'none'}; margin-top: 10px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="color: #ef4444; font-size: 0.75rem; font-weight: bold;">Alert Banner</label>
                <button type="button" class="remove-alert-btn" style="background: transparent; color: #ef4444; border: none; cursor: pointer; font-size: 0.75rem;">Remove Banner</button>
            </div>
            <div id="quill_alert_${sectionId}" style="height: 60px; background: #fef2f2; color: black; border-radius: 4px; border-left: 4px solid #ef4444;"></div>
        </div>
    `;

    container.appendChild(sectionDiv);

    sectionDiv.querySelector('.remove-section-btn').addEventListener('click', () => {
        sectionDiv.remove();
        delete quillInstances[sectionId];
        delete quillSubInstances[sectionId];
        delete quillAlertInstances[sectionId];
    });

    const toolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
    ];

    const quill = new Quill(`#quill_${sectionId}`, { theme: 'snow', modules: { toolbar: toolbarOptions } });
    if (content) quill.clipboard.dangerouslyPasteHTML(content);
    quillInstances[sectionId] = quill;

    const subWrapper = sectionDiv.querySelector('.sub-wrapper');
    const quillSub = new Quill(`#quill_sub_${sectionId}`, { theme: 'snow', modules: { toolbar: toolbarOptions } });
    if (subContent) quillSub.clipboard.dangerouslyPasteHTML(subContent);
    quillSubInstances[sectionId] = quillSub;

    sectionDiv.querySelector('.toggle-sub-btn').addEventListener('click', () => {
        subWrapper.style.display = 'block';
    });
    sectionDiv.querySelector('.remove-sub-btn').addEventListener('click', () => {
        quillSub.setText('');
        subWrapper.style.display = 'none';
    });

    const alertWrapper = sectionDiv.querySelector('.alert-wrapper');
    const quillAlert = new Quill(`#quill_alert_${sectionId}`, { theme: 'snow', modules: { toolbar: toolbarOptions } });
    if (alertContent) quillAlert.clipboard.dangerouslyPasteHTML(alertContent);
    quillAlertInstances[sectionId] = quillAlert;

    sectionDiv.querySelector('.toggle-alert-btn').addEventListener('click', () => {
        alertWrapper.style.display = 'block';
    });
    sectionDiv.querySelector('.remove-alert-btn').addEventListener('click', () => {
        quillAlert.setText('');
        alertWrapper.style.display = 'none';
    });
}

async function saveTournamentInfo() {
    const tournamentId = getTournamentId();
    if (!tournamentId) return;

    const container = document.getElementById('infoSectionsContainer');
    const sectionCards = container.querySelectorAll('.info-section-card');
    
    const infoDataArray = [];

    sectionCards.forEach(card => {
        const id = card.dataset.id;
        const icon = card.querySelector('.section-icon').value || '';
        const title = card.querySelector('.section-title').value || '';
        
        let content = quillInstances[id].root.innerHTML.replace(/(<p><br><\/p>\s*)+$/, '');
        
        const subWrapper = card.querySelector('.sub-wrapper');
        const alertWrapper = card.querySelector('.alert-wrapper');

        let subContent = '';
        if (subWrapper.style.display !== 'none' && quillSubInstances[id]) {
            const rawSub = quillSubInstances[id].root.innerHTML;
            if (rawSub !== '<p><br></p>') subContent = rawSub;
        }

        let alertContent = '';
        if (alertWrapper.style.display !== 'none' && quillAlertInstances[id]) {
            const rawAlert = quillAlertInstances[id].root.innerHTML;
            if (rawAlert !== '<p><br></p>') alertContent = rawAlert;
        }

        if (title.trim() !== '') {
            infoDataArray.push({ icon, title, content, subContent, alertContent });
        }
    });

    const { error } = await supabase.from('tournaments').update({ info_data: infoDataArray }).eq('id', tournamentId);

    if (error) alert("Error saving info: " + error.message);
    else {
        alert("Tournament info saved successfully!");
        loadTournamentInfo(); 
    }
}