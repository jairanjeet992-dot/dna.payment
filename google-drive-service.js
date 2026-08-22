/**
 * Google Drive Service
 * Handles file listing, folder creation, and uploads using Google Identity Services.
 */
window.googleDriveService = {
  accessToken: null,
  client: null,
  
  // Scopes required
  SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
  
  init(clientId) {
    if (!clientId) {
      console.warn('[DRIVE] No Client ID provided');
      return;
    }
    if (typeof google === 'undefined' || !google.accounts) {
      console.warn('[DRIVE] GSI library not loaded yet');
      return;
    }
    this.client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: this.SCOPES,
      callback: (response) => {
        if (response.error !== undefined) {
          console.error('[DRIVE] OAuth Error:', response);
          return;
        }
        this.accessToken = response.access_token;
        console.log('[DRIVE] Token acquired');
        if (this.onTokenAcquired) this.onTokenAcquired(response);
      },
    });
  },

  requestToken() {
    if (this.client) {
      this.client.requestAccessToken({ prompt: 'consent' });
    } else {
      console.error('[DRIVE] Client not initialized. Attempting late init...'); if (typeof window.initGoogleDriveOnLoad === 'function') window.initGoogleDriveOnLoad(); if (this.client) { this.client.requestAccessToken({ prompt: 'consent' }); return; }
      showToast('Google Drive client not initialized. Please refresh.', true);
    }
  },

  setToken(token) {
    this.accessToken = token;
    console.log('[DRIVE] Token manually set');
  },

  async call(url, options = {}) {
    if (!this.accessToken) throw new Error('No access token. Please connect Google Drive in Settings.');
    
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      ...options.headers
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      this.accessToken = null;
      throw new Error('Session expired. Please reconnect Google Drive in Settings.');
    }
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Drive API error');
    }
    
    return await response.json();
  },

  async listFiles(query = "'root' in parents") {
    const data = await this.call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)`);
    return data.files || [];
  },

  async getOrCreateFolder(name, parentId = 'root') {
    const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
    const files = await this.listFiles(query);
    if (files.length > 0) return files[0];

    // Create if not found
    return await this.call('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });
  },

  async setupBaseFolders() {
    const root = await this.getOrCreateFolder('DNA Payments');
    const companies = await this.getOrCreateFolder('Companies', root.id);
    const investigators = await this.getOrCreateFolder('Investigator Documents', root.id);
    const reports = await this.getOrCreateFolder('Reports', root.id);
    const backups = await this.getOrCreateFolder('Monthly Backup', root.id);
    
    return {
      rootId: root.id,
      companiesId: companies.id,
      investigatorsId: investigators.id,
      reportsId: reports.id,
      backupsId: backups.id
    };
  },

  async setupCaseFolders(companyName, docCode, companiesParentId) {
    const companyFolder = await this.getOrCreateFolder(companyName, companiesParentId);
    const caseFolder = await this.getOrCreateFolder(docCode, companyFolder.id);
    const photos = await this.getOrCreateFolder('Photos', caseFolder.id);
    const docs = await this.getOrCreateFolder('Documents', caseFolder.id);
    const finalReport = await this.getOrCreateFolder('Final Report', caseFolder.id);
    
    return {
      caseFolderId: caseFolder.id,
      caseFolderUrl: `https://drive.google.com/drive/folders/${caseFolder.id}`,
      photosId: photos.id,
      docsId: docs.id,
      finalReportId: finalReport.id
    };
  },

  async uploadFile(file, metadata = {}) {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Upload failed');
    }
    
    return await response.json();
  }
};
