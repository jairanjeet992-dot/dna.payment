// custom-fields.js
// Handles dynamic custom fields (JSONB) for DNA cases

window.CUSTOM_FIELDS = []; // Format: [{ id: 'cf_123', name: 'Claim Amount', type: 'number' }]

// Called directly from loadSettingsFromDB after data is fetched
window.renderCustomFieldsSettings = function() {
    const list = document.getElementById('settings-customfields-list');
    if (!list) return;
    if (window.CUSTOM_FIELDS.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:var(--sub); text-align:center;">No custom fields added</div>';
        return;
    }
    list.innerHTML = window.CUSTOM_FIELDS.map(cf => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid var(--line);">
            <span><b>${cf.name}</b> <small style="color:var(--sub)">(${cf.type})</small></span>
            <button class="btn btn-sm" style="color:var(--red); background:none; border:none;" onclick="removeCustomField('${cf.id}')">✖</button>
        </div>
    `).join('');
}

// Add new field from settings UI
window.addCustomField = async function() {
    const nameInput = document.getElementById('new-customfield-name');
    const typeSelect = document.getElementById('new-customfield-type');
    const name = nameInput.value.trim();
    if (!name) return;
    
    const newField = {
        id: 'cf_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        name: name,
        type: typeSelect.value
    };
    
    window.CUSTOM_FIELDS.push(newField);
    nameInput.value = '';
    
    await saveCustomFieldsConfig();
}

window.removeCustomField = async function(id) {
    
    window.CUSTOM_FIELDS = window.CUSTOM_FIELDS.filter(cf => cf.id !== id);
    await saveCustomFieldsConfig();
}

window.saveCustomFieldsConfig = async function() {
    if (typeof window.supabaseClient === 'undefined') return;
    const { error } = await window.supabaseClient.from('agency_settings').update({
        custom_fields_config: window.CUSTOM_FIELDS
    }).eq('id', 1);
    
    if (error) {
        if(window.showToast) window.showToast('Failed to save custom fields: ' + error.message, true);
    } else {
        if(window.showToast) window.showToast('Custom fields updated');
        window.renderCustomFieldsSettings();
        window.injectCustomHeadersIntoTable();
        window.injectCustomFieldsIntoForm();
        if (typeof window.renderAll === 'function') window.renderAll();
    }
}

window.injectCustomFieldsIntoForm = function() {
    const container = document.getElementById('dynamic-custom-fields');
    if (!container) return;
    
    if (window.CUSTOM_FIELDS.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    
    container.style.display = '';
    container.innerHTML = window.CUSTOM_FIELDS.map(cf => `
        <div class="fg">
            <label>${cf.name}</label>
            <input type="${cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}" 
                   id="f-cf-${cf.id}" data-cfid="${cf.id}" ${cf.type === 'number' ? 'step="any"' : ''} class="dynamic-cf-input">
        </div>
    `).join('');
}

window.populateCustomFieldsInForm = function(customData) {
    window.CUSTOM_FIELDS.forEach(cf => {
        const el = document.getElementById('f-cf-' + cf.id);
        if (el) el.value = customData ? (customData[cf.id] || '') : '';
    });
}

window.extractCustomFieldValuesFromForm = function() {
    const data = {};
    let hasData = false;
    window.CUSTOM_FIELDS.forEach(cf => {
        const el = document.getElementById('f-cf-' + cf.id);
        if (el && el.value) {
            data[cf.id] = cf.type === 'number' ? Number(el.value) : el.value;
            hasData = true;
        }
    });
    return hasData ? data : null;
}

window.injectCustomHeadersIntoTable = function() {
    const theadTr = document.querySelector('#cases-table thead tr');
    if (!theadTr) return;
    
    // Remove existing custom headers first
    const existing = theadTr.querySelectorAll('.dynamic-th');
    existing.forEach(e => e.remove());
    
    // Find the <th> before the one that says "Invoice No ⇅".
    let targetTh = null;
    Array.from(theadTr.children).forEach(th => {
        if (th.textContent.includes('Invoice No')) targetTh = th;
    });
    
    window.CUSTOM_FIELDS.forEach(cf => {
        const th = document.createElement('th');
        th.className = 'dynamic-th';
        th.textContent = cf.name;
        if (targetTh) {
            theadTr.insertBefore(th, targetTh);
        } else {
            theadTr.appendChild(th);
        }
    });
}

// Override parseCsvRows dynamic injection mapping
if (typeof window.parseCsvRows === 'function') {
    // We don't redefine it globally unless needed. Actually, modifying colMap inside app.js parseCsvRows is cleaner.
}
