<?php
require __DIR__ . '/api/_session.php';

// ── Read .env ────────────────────────────────────────────────────────────────
$envFile = __DIR__ . '/.env';
$env = [];
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $env[trim($k)] = trim($v, " \t\"'");
    }
}

$appPassword = $env['APP_PASSWORD'] ?? '';

// ── APP_PASSWORD gate ─────────────────────────────────────────────────────────
// If APP_PASSWORD is set, the visitor must pass it before we do anything else.
$appAuthed = false;
if ($appPassword) {
    // Check session
    if (!empty($_SESSION['app_auth'])) {
        $appAuthed = true;
    }
    // Check remember-me cookie — validate against persisted token file
    if (!$appAuthed && !empty($_COOKIE['yoursql_remember'])) {
        $tokenFile  = __DIR__ . '/data/app_remember_tokens.json';
        $cookieHash = hash('sha256', $_COOKIE['yoursql_remember']);
        if (file_exists($tokenFile)) {
            $tokens = json_decode(file_get_contents($tokenFile), true) ?? [];
            foreach ($tokens as $t) {
                if (($t['hash'] ?? '') === $cookieHash && ($t['expires'] ?? 0) > time()) {
                    $_SESSION['app_auth'] = true;
                    $appAuthed = true;
                    break;
                }
            }
        }
    }
} else {
    $appAuthed = true; // no password configured
}

if (!$appAuthed) {
    // Show password screen and stop
    ?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YourSQL</title>
    <link rel="stylesheet" href="assets/css/main.css">
    <link rel="stylesheet" href="assets/css/login.css">
</head>
<body class="login-page">
    <div class="login-container">
        <div class="login-card">
            <div class="login-logo">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="24" cy="12" rx="18" ry="6" fill="#4f8ef7"/>
                    <path d="M6 12v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    <path d="M6 20v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    <path d="M6 28v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                </svg>
                <h1>YourSQL</h1>
            </div>

            <p class="app-password-hint">Enter the app password to continue.</p>

            <form id="app-password-form" autocomplete="off">
                <div class="form-group">
                    <label for="app-password">App Password</label>
                    <input type="password" id="app-password" name="app-password"
                           placeholder="••••••••" autocomplete="current-password" autofocus>
                </div>
                <div class="remember-row">
                    <label class="remember-label">
                        <input type="checkbox" id="app-remember"> Remember me for 30 days
                    </label>
                </div>
                <div id="app-password-error" class="error-msg hidden"></div>
                <button type="submit" class="btn-primary" id="app-password-btn">
                    <span class="btn-text">Unlock</span>
                    <span class="btn-loader hidden"></span>
                </button>
            </form>
        </div>
    </div>
    <script src="assets/js/login.js?v=<?= filemtime(__DIR__.'/assets/js/login.js') ?>"></script>
</body>
</html>
<?php
    exit;
}

// ── Auto-login from .env ──────────────────────────────────────────────────────
$envError = null;
if (empty($_SESSION['db_config'])) {
    $username = $env['DB_USERNAME'] ?? $env['DB_USER'] ?? '';
    if ($username) {
        $cfg = [
            'host'     => $env['DB_HOST']     ?? 'localhost',
            'port'     => (int)($env['DB_PORT']     ?? 3306),
            'username' => $username,
            'password' => $env['DB_PASSWORD'] ?? $env['DB_PASS'] ?? '',
            'database' => $env['DB_DATABASE'] ?? $env['DB_NAME'] ?? '',
        ];
        try {
            $pdo = getConnection($cfg);
            $pdo->query('SELECT 1');
            $_SESSION['db_config'] = $cfg;
            header('Location: app.php');
            exit;
        } catch (PDOException) {
            $envError = 'Auto-connect failed — check your .env credentials';
        }
    }
}

// Already logged in
if (!empty($_SESSION['db_config'])) {
    header('Location: app.php');
    exit;
}
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YourSQL</title>
    <link rel="stylesheet" href="assets/css/main.css">
    <link rel="stylesheet" href="assets/css/login.css">
</head>
<body class="login-page">
    <div class="login-container">
        <div class="login-card">
            <div class="login-logo">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="24" cy="12" rx="18" ry="6" fill="#4f8ef7"/>
                    <path d="M6 12v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    <path d="M6 20v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                    <path d="M6 28v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                </svg>
                <h1>YourSQL</h1>
            </div>

            <?php if (!empty($envError)): ?>
            <div class="error-msg" style="margin-bottom:16px"><?= htmlspecialchars($envError) ?></div>
            <?php endif; ?>

            <form id="login-form" autocomplete="off">
                <div class="form-group">
                    <label for="host">Host</label>
                    <input type="text" id="host" name="host" value="localhost" placeholder="localhost" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="port">Port</label>
                        <input type="number" id="port" name="port" value="3306" placeholder="3306">
                    </div>
                    <div class="form-group flex-3">
                        <label for="username">Username</label>
                        <input type="text" id="username" name="username" placeholder="root" required autocomplete="username">
                    </div>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" placeholder="••••••••" autocomplete="current-password">
                </div>
                <div class="form-group">
                    <label for="database">Database <span class="optional">(optional)</span></label>
                    <input type="text" id="database" name="database" placeholder="leave empty to browse all">
                </div>
                <div id="login-error" class="error-msg hidden"></div>
                <button type="submit" class="btn-primary" id="login-btn">
                    <span class="btn-text">Connect</span>
                    <span class="btn-loader hidden"></span>
                </button>
            </form>
        </div>
    </div>
    <script src="assets/js/login.js?v=<?= filemtime(__DIR__.'/assets/js/login.js') ?>"></script>
</body>
</html>
