<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db       = trim($body['database']  ?? '');
$table    = trim($body['table']     ?? '');
$col      = trim($body['column']    ?? '');
$val      = $body['value']          ?? null;

if (!$db || !$table || !$col) {
    jsonOut(['success' => false, 'error' => 'database, table and column are required']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) ||
    !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table) ||
    !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $col)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);

    $stmt = $pdo->prepare("SELECT * FROM `{$db}`.`{$table}` WHERE `{$col}` = ? LIMIT 1");
    $stmt->execute([$val]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonOut(['success' => false, 'error' => 'Row not found']);
    }

    jsonOut(['success' => true, 'row' => $row]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
