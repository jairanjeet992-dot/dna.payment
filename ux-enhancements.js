// ==========================================
// UX & SPEED ENHANCEMENTS (Keyboard + Mouse)
// ==========================================

function initUXEnhancements() {
    // Inject CSS for Sticky Headers
    const style = document.createElement('style');
    style.innerHTML = `
        .tbl-scroll, .table-container { position: relative; }
        .tbl-scroll th, table.data-table th, #cases-table th, #monthly-table th {
            position: sticky;
            top: 0;
            z-index: 10;
            background: var(--paper, #fff);
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        body.dark-mode .tbl-scroll th, body.dark-mode table.data-table th, body.dark-mode #cases-table th, body.dark-mode #monthly-table th {
            background: var(--surface-1, #1a222c);
        }
    `;
    document.head.appendChild(style);

    document.addEventListener('keydown', (e) => {
        // 1. ESC -> Close Modal
        if (e.key === 'Escape') {
            document.querySelectorAll('.overlay').forEach(overlay => {
                if (overlay.classList.contains('open')) overlay.classList.remove('open');
                if (overlay.style.display !== 'none' && overlay.style.display !== '') overlay.style.display = 'none';
            });
            if (typeof closePDFPreview === 'function') closePDFPreview();
        }

        // 2. SLASH (/) -> Quick Search Focus
        if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
            e.preventDefault(); 
            const activeView = document.querySelector('.view.active');
            if (activeView && activeView.id === 'view-cases') {
                document.getElementById('search-cases')?.focus();
            } else if (activeView && activeView.id === 'view-investigators') {
                document.getElementById('inv360-search')?.focus();
            }
        }

        // 3. ENTER -> Submit/Save in modals without forms
        if (e.key === 'Enter') {
            const activeInput = document.activeElement;
            if (activeInput && ['INPUT', 'SELECT'].includes(activeInput.tagName)) {
                if (activeInput.closest('form')) return;
                const openOverlay = activeInput.closest('.overlay');
                if (openOverlay) {
                    const primaryBtn = openOverlay.querySelector('.btn-navy, .btn-danger, .btn-gold');
                    if (primaryBtn) {
                        e.preventDefault();
                        primaryBtn.click();
                    }
                }
            }
        }
    });

    // 4. Click outside overlay to close
    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.addEventListener('mousedown', function(e) {
            if (e.target === this) {
                this.classList.remove('open');
                if (this.style.display !== 'none') this.style.display = 'none';
            }
        });
    });

    // 5. Auto-Focus input logic on Modal open
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                const target = mutation.target;
                if (target.classList.contains('overlay') && (target.classList.contains('open') || target.style.display === 'flex')) {
                    setTimeout(() => {
                        const firstInput = target.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([hidden]):not([disabled]):not([readonly])');
                        if (firstInput && !firstInput.value) { 
                           firstInput.focus();
                        } else if (firstInput) {
                           firstInput.focus();
                        }
                    }, 50);
                }
            }
        });
    });

    document.querySelectorAll('.overlay').forEach(overlay => {
        observer.observe(overlay, { attributes: true });
    });

    // 6. Double Click to Edit
    document.addEventListener('dblclick', (e) => {
        const tr = e.target.closest('tr[data-idx]');
        if (tr) {
            // Prevent if clicked on a button, input, or link inside the row
            if (['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA'].includes(e.target.tagName)) return;
            
            const idx = tr.getAttribute('data-idx');
            if (idx && typeof editCase === 'function') {
                editCase(idx);
            }
        }
    });

    // 7. Auto-Capitalization & Formatting
    document.addEventListener('focusout', (e) => {
        if (!e.target.matches('input[type="text"]')) return;
        
        const upperCaseFields = ['f-claim', 'f-policy', 'f-companyawb', 'f-invoice'];
        const titleCaseFields = ['f-insured', 'f-location', 'new-inv-name'];
        
        const id = e.target.id;
        
        if (upperCaseFields.includes(id)) {
            e.target.value = e.target.value.toUpperCase();
        } else if (titleCaseFields.includes(id)) {
            e.target.value = e.target.value.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        }
    });

    // 8. Shift + Click for Checkboxes
    let lastChecked = null;
    document.addEventListener('click', (e) => {
        if (!e.target.matches('input[type="checkbox"]')) return;
        
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        if (!checkboxes.includes(e.target)) return;

        if (e.shiftKey && lastChecked) {
            const start = checkboxes.indexOf(e.target);
            const end = checkboxes.indexOf(lastChecked);
            
            const range = [start, end].sort((a, b) => a - b);
            const isChecked = lastChecked.checked;
            
            for (let i = range[0]; i <= range[1]; i++) {
                checkboxes[i].checked = isChecked;
                // Trigger change event so any listeners (like updating counts) fire
                checkboxes[i].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        
        lastChecked = e.target;
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUXEnhancements);
} else {
    initUXEnhancements();
}
