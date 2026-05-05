<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$envFile = dirname(__DIR__) . '/.env';
$appPassword = '';

if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        if (trim($k) === 'APP_PASSWORD') {
            $appPassword = trim($v, " \t\"'");
            break;
        }
    }
}

if (!$appPassword) {
    jsonOut(['success' => true]);
}

$body      = jsonBody();
$submitted = $body['password'] ?? '';
$remember  = !empty($body['remember']);

if ($submitted !== $appPassword) {
    jsonOut(['success' => false, 'error' => 'Incorrect password']);
}

$_SESSION['app_auth'] = true;

if ($remember) {
    $token     = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $tokenFile = dirname(__DIR__) . '/data/app_remember_tokens.json';

    // Load existing valid tokens
    $tokens = [];
    if (file_exists($tokenFile)) {
        $tokens = json_decode(file_get_contents($tokenFile), true) ?? [];
    }

    // Prune expired entries
    $now = time();
    $tokens = array_filter($tokens, fn($t) => ($t['expires'] ?? 0) > $now);

    $expires = $now + 60 * 60 * 24 * 30; // 30 days
    $tokens[] = ['hash' => $tokenHash, 'expires' => $expires];

    @mkdir(dirname($tokenFile), 0750, true);
    file_put_contents($tokenFile, json_encode(array_values($tokens)), LOCK_EX);

    setcookie('yoursql_remember', $token, [
        'expires'  => $expires,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

jsonOut(['success' => true]);
