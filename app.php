<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YourSQL</title>
    <link rel="stylesheet" href="assets/css/main.css?v=<?= filemtime(__DIR__.'/assets/css/main.css') ?>">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= filemtime(__DIR__.'/assets/css/app.css') ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/dracula.min.css">
</head>
<body class="app-page">

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                    <ellipse cx="24" cy="12" rx="18" ry="6" fill="#4f8ef7"/>
                    <path d="M6 12v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    <path d="M6 20v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    <path d="M6 28v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                </svg>
                <span>YourSQL</span><a class="sidebar-version" href="https://mvmrik.com/apps/your_sql" target="_blank" rel="noopener">v1.0.0</a>
            </div>
            <button class="sidebar-toggle" id="sidebar-toggle" title="Hide sidebar">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.354 1.646a.5.5 0 010 .708L6.707 7l4.647 4.646a.5.5 0 01-.708.708l-5-5a.5.5 0 010-.708l5-5a.5.5 0 01.708 0z"/>
                </svg>
            </button>
        </div>

        <div class="sidebar-server-info" id="server-info">
            <div class="server-badge">
                <span class="dot online"></span>
                <div class="server-badge-text">
                    <span id="server-label">localhost</span>
                    <span id="server-user" class="server-user"></span>
                </div>
            </div>
            <button class="btn-disconnect" id="btn-disconnect" title="Disconnect">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M10 12.5a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5h8a.5.5 0 01.5.5v2a.5.5 0 001 0v-2A1.5 1.5 0 009.5 2h-8A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h8a1.5 1.5 0 001.5-1.5v-2a.5.5 0 00-1 0v2z"/>
                    <path d="M15.854 8.354a.5.5 0 000-.708l-3-3a.5.5 0 10-.708.708L14.293 7.5H5.5a.5.5 0 000 1h8.793l-2.147 2.146a.5.5 0 00.708.708l3-3z"/>
                </svg>
            </button>
        </div>

        <div class="sidebar-search">
            <input type="text" id="db-search" placeholder="Search databases..." autocomplete="off">
        </div>

        <nav class="sidebar-nav" id="db-tree">
            <div class="loading-tree">
                <div class="spinner"></div>
                <span>Loading...</span>
            </div>
        </nav>
    </aside>

    <!-- Mobile overlay -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <!-- Main content -->
    <main class="main-content" id="main-content">
        <header class="topbar">
            <button class="mobile-menu-btn" id="mobile-menu-btn">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.5 3h11a.5.5 0 000-1h-11a.5.5 0 000 1zm0 4h11a.5.5 0 000-1h-11a.5.5 0 000 1zm0 4h11a.5.5 0 000-1h-11a.5.5 0 000 1z"/>
                </svg>
            </button>
            <button class="sidebar-expand" id="sidebar-expand" title="Show sidebar">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.646 1.646a.5.5 0 010 .708L9.293 7 4.646 11.646a.5.5 0 00.708.708l5-5a.5.5 0 000-.708l-5-5a.5.5 0 00-.708 0z"/>
                </svg>
            </button>
            <div class="breadcrumb" id="breadcrumb">
                <span class="crumb">Dashboard</span>
            </div>
            <div class="topbar-actions" id="topbar-actions"></div>
            <button class="btn-settings" id="btn-settings" title="Settings">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/>
                    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 003.06 8.693l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 004.175 4.13l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/>
                </svg>
            </button>
        </header>

        <div class="content-area" id="content-area">
            <div class="welcome-screen">
                <div class="welcome-icon">
                    <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
                        <ellipse cx="24" cy="12" rx="18" ry="6" fill="#4f8ef7" opacity=".2"/>
                        <path d="M6 12v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none" opacity=".4"/>
                        <path d="M6 20v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none" opacity=".7"/>
                        <path d="M6 28v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    </svg>
                </div>
                <h2>Select a database</h2>
                <p>Choose a database from the left panel to start browsing tables and data.</p>
            </div>
        </div>
    </main>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/sql/sql.min.js"></script>
    <script src="assets/js/app.js?v=<?= filemtime(__DIR__.'/assets/js/app.js') ?>"></script>
</body>
</html>
