<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$envFile = dirname(__DIR__) . '/.env';

if (!file_exists($envFile)) {
    jsonOut(['success' => false, 'error' => '.env file not found']);
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$env = [];
foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#')) continue;
    if (!str_contains($line, '=')) continue;
    [$key, $val] = explode('=', $line, 2);
    $env[trim($key)] = trim($val, " \t\"'");
}

$host     = $env['DB_HOST']     ?? 'localhost';
$port     = (int)($env['DB_PORT']     ?? 3306);
$username = $env['DB_USERNAME'] ?? $env['DB_USER'] ?? '';
$password = $env['DB_PASSWORD'] ?? $env['DB_PASS'] ?? '';
$database = $env['DB_DATABASE'] ?? $env['DB_NAME'] ?? '';

if (!$username) {
    jsonOut(['success' => false, 'error' => 'DB_USERNAME not set in .env']);
}

try {
    $cfg = compact('host', 'port', 'username', 'password', 'database');
    $pdo = getConnection($cfg);
    $pdo->query('SELECT 1');
    $_SESSION['db_config'] = $cfg;
    jsonOut(['success' => true]);
} catch (PDOException $e) {
    $msg = preg_replace('/\[.*?\]/', '', $e->getMessage());
    jsonOut(['success' => false, 'error' => trim($msg)]);
}
