<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg = requireSession();

try {
    $pdo = getConnection($cfg);

    $stmt = $pdo->query("
        SELECT
            s.schema_name AS `name`,
            COUNT(t.table_name) AS table_count
        FROM information_schema.schemata s
        LEFT JOIN information_schema.tables t
            ON t.table_schema = s.schema_name
        WHERE s.schema_name NOT IN ('information_schema','performance_schema','mysql','sys')
        GROUP BY s.schema_name
        ORDER BY s.schema_name
    ");

    $databases = $stmt->fetchAll();

    jsonOut(['success' => true, 'databases' => $databases]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
