# GitHub Deployment Setup

Follow these steps to deploy the **DNA Payment Management System** to GitHub Pages correctly.

### 1. Repository Structure
Ensure your GitHub repository matches the following structure exactly. Do not flatten the `frontend` folder, as `index.html` depends on the relative paths.

```text
dna-payment/ (Repository Root)
├── index.html
├── app.js
├── firebase-init.js
├── ... (other core JS/CSS files)
└── frontend/
    └── investigator-360/
        ├── investigator-360.css
        └── investigator-360.js
```

### 2. Configure GitHub Pages
1. Go to your repository **Settings** on GitHub.
2. Click on **Pages** in the left sidebar.
3. Under **Build and deployment > Branch**, select `main` and `/ (root)`.
4. Click **Save**.

### 3. Critical: Handling Browser Caching
GitHub Pages often caches old versions of your scripts. After you push a new update (like the new `investigator-360.js` version):
*   Open your live URL.
*   Press **Ctrl + F5** (Windows/Linux) or **Cmd + Shift + R** (Mac) to perform a **Hard Refresh**.
*   This ensures the browser loads the new files from the `frontend/` directory instead of the old cached versions from the root.

### 4. Configuration
Ensure your `firebase-applet-config.json` is updated with your live Firebase project credentials before pushing to GitHub.

---
**Note:** If you encounter a 404 error for the files in the `frontend/` folder, double-check that you haven't added `frontend/` to your `.gitignore` file.
