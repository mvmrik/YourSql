<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();
$db   = trim($body['database'] ?? '');

if (!$db) {
    jsonOut(['success' => false, 'error' => 'Database name required']);
}

try {
    $pdo = getConnection($cfg);

    $stmt = $pdo->prepare("
        SELECT
            t.table_name AS `name`,
            t.table_rows AS `rows`,
            t.table_type AS `type`
        FROM information_schema.tables t
        WHERE t.table_schema = ?
        ORDER BY t.table_name
    ");
    $stmt->execute([$db]);
    $tables = $stmt->fetchAll();

    jsonOut(['success' => true, 'tables' => $tables]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
