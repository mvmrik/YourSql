<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$body = jsonBody();

$host     = trim($body['host']     ?? 'localhost');
$port     = (int)($body['port']    ?? 3306);
$username = trim($body['username'] ?? '');
$password = $body['password']      ?? '';
$database = trim($body['database'] ?? '');

if (!$username) {
    jsonOut(['success' => false, 'error' => 'Username is required']);
}

try {
    $cfg = compact('host', 'port', 'username', 'password', 'database');
    $pdo = getConnection($cfg);

    // Verify connection works
    $pdo->query('SELECT 1');

    $_SESSION['db_config'] = $cfg;

    jsonOut(['success' => true]);
} catch (PDOException $e) {
    $msg = $e->getMessage();
    // Strip internal details from error
    $msg = preg_replace('/\[.*?\]/', '', $msg);
    $msg = trim($msg);
    jsonOut(['success' => false, 'error' => $msg]);
}
