<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db    = trim($body['database'] ?? '');
$table = trim($body['table']    ?? '');

if (!$db || !$table) {
    jsonOut(['success' => false, 'error' => 'Database and table are required']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);

    $stmt = $pdo->query("DESCRIBE `{$db}`.`{$table}`");
    $structure = $stmt->fetchAll();

    jsonOut(['success' => true, 'structure' => $structure]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
