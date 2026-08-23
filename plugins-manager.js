window.dnaPlugins = [
  {
    id: 'dark-mode',
    title: 'Cinematic Dark Mode',
    description: 'Forces the entire dashboard into a high-contrast dark theme, reducing eye strain for night work.',
    icon: '🌙',
    enabled: false,
    onEnable: () => document.body.classList.add('dark-mode'),
    onDisable: () => document.body.classList.remove('dark-mode')
  },
  {
    id: 'compact-density',
    title: 'High-Density Table View',
    description: 'Reduces padding, font sizes, and row heights across all tables so you can view up to 40% more records without scrolling.',
    icon: '🗜️',
    enabled: false,
    onEnable: () => document.body.classList.add('plugin-compact'),
    onDisable: () => document.body.classList.remove('plugin-compact')
  },
  {
    id: 'privacy-mode',
    title: 'Screenshare Privacy Blur',
    description: 'Instantly blurs sensitive case data (like Insured Names and Claim Numbers) so you can safely share your screen with clients on Zoom.',
    icon: '🕵️',
    enabled: false,
    onEnable: () => document.body.classList.add('plugin-privacy'),
    onDisable: () => document.body.classList.remove('plugin-privacy')
  },
  {
    id: 'focus-mode',
    title: 'Zen Focus Mode',
    description: 'Hides the top navigation bar, tabs, and side panels, giving you a full-screen, distraction-free view of your data.',
    icon: '🧘',
    enabled: false,
    onEnable: () => document.body.classList.add('plugin-focus'),
    onDisable: () => document.body.classList.remove('plugin-focus')
  }
];

window.loadPlugins = function() {
  const saved = JSON.parse(localStorage.getItem('dna_plugins') || '{}');
  window.dnaPlugins.forEach(p => {
    if (saved[p.id] === true) {
      p.enabled = true;
      if (p.onEnable) p.onEnable();
    }
  });
  renderPluginList();
};

window.togglePlugin = function(id) {
  const plugin = window.dnaPlugins.find(p => p.id === id);
  if (!plugin) return;
  
  plugin.enabled = !plugin.enabled;
  
  const saved = JSON.parse(localStorage.getItem('dna_plugins') || '{}');
  saved[id] = plugin.enabled;
  localStorage.setItem('dna_plugins', JSON.stringify(saved));
  
  if (plugin.enabled && plugin.onEnable) plugin.onEnable();
  if (!plugin.enabled && plugin.onDisable) plugin.onDisable();
  
  renderPluginList();
  
  // Show a toast notification
  if (window.showToast) {
    window.showToast(plugin.title + (plugin.enabled ? ' Enabled' : ' Disabled'));
  }
};

window.renderPluginList = function() {
  const container = document.getElementById('plugin-list');
  if (!container) return;
  
  container.innerHTML = window.dnaPlugins.map(p => `
    <div style="display:flex;align-items:center;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,0.04);transition:all 0.2s;">
      <div style="font-size:28px;margin-right:20px;width:40px;text-align:center;background:var(--paper);border-radius:50%;padding:10px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);">${p.icon}</div>
      <div style="flex:1;">
        <div style="font-weight:800;font-size:15px;color:var(--navy);margin-bottom:6px;letter-spacing:0.3px;">${p.title}</div>
        <div style="font-size:12.5px;color:var(--sub);line-height:1.5;max-width:90%;">${p.description}</div>
      </div>
      <div style="margin-left:20px;">
        <button class="btn ${p.enabled ? 'btn-ghost' : 'btn-navy'}" onclick="togglePlugin('${p.id}')" style="min-width:100px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px;padding:10px 16px;border-radius:20px;">
          ${p.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  `).join('');
};

// Inject the CSS for our plugins
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.innerHTML = `
    /* Compact Density Plugin */
    body.plugin-compact th { padding: 4px 8px !important; font-size: 10px !important; }
    body.plugin-compact td { padding: 3px 8px !important; font-size: 11px !important; }
    body.plugin-compact .badge { padding: 1px 4px !important; font-size: 9px !important; }
    
    /* Screenshare Privacy Blur Plugin */
    /* Blurs specific columns in the Cases table: Insured Name (col 7), Phone (col 10), Account No (col 14) */
    body.plugin-privacy #cases-tbody tr td:nth-child(7),
    body.plugin-privacy #cases-tbody tr td:nth-child(10),
    body.plugin-privacy #cases-tbody tr td:nth-child(14) {
      filter: blur(5px);
      transition: filter 0.2s;
    }
    body.plugin-privacy #cases-tbody tr td:nth-child(7):hover,
    body.plugin-privacy #cases-tbody tr td:nth-child(10):hover,
    body.plugin-privacy #cases-tbody tr td:nth-child(14):hover {
      filter: blur(0px); /* Reveal on hover */
    }
    
    /* Zen Focus Mode Plugin */
    body.plugin-focus .topbar,
    body.plugin-focus .tabs {
      display: none !important;
    }
    body.plugin-focus .view {
      padding-top: 40px !important;
    }
    
    /* Floating Exit Focus Button (only shows in focus mode) */
    #exit-focus-btn {
      display: none;
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 9999;
      background: var(--navy);
      color: #fff;
      border: none;
      border-radius: 30px;
      padding: 12px 24px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    body.plugin-focus #exit-focus-btn {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #exit-focus-btn:hover {
      background: var(--gold);
      color: var(--navy);
    }
  `;
  document.head.appendChild(style);
  
  // Add the floating exit button to the body
  const exitBtn = document.createElement('button');
  exitBtn.id = 'exit-focus-btn';
  exitBtn.innerHTML = '🧘 Exit Focus Mode';
  exitBtn.onclick = () => togglePlugin('focus-mode');
  document.body.appendChild(exitBtn);
  
  // Initialize plugins
  window.loadPlugins();
});

window.openPluginsModal = function() {
  const modal = document.getElementById('plugins-modal');
  if (modal) {
    modal.classList.add('open');
    modal.style.display = ''; // Clear inline style if present
  }
};

// Handle Escape key to close modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const pluginsModal = document.getElementById('plugins-modal');
    if (pluginsModal && pluginsModal.classList.contains('open')) {
      if (typeof closeModal === 'function') closeModal('plugins-modal');
      else pluginsModal.classList.remove('open');
    }
  }
});

// Handle clicking outside the modal to close it
document.addEventListener('DOMContentLoaded', () => {
  const pluginsModal = document.getElementById('plugins-modal');
  if (pluginsModal) {
    pluginsModal.addEventListener('click', function(e) {
      if (e.target === this) {
        if (typeof closeModal === 'function') closeModal('plugins-modal');
        else this.classList.remove('open');
      }
    });
  }
});

