<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

requireSession();

try {
    $pdo  = getConnection(requireSession());
    $stmt = $pdo->query("
        SELECT c.COLLATION_NAME AS collation,
               c.CHARACTER_SET_NAME AS charset,
               IF(cs.DEFAULT_COLLATE_NAME = c.COLLATION_NAME, 1, 0) AS is_default
        FROM information_schema.COLLATIONS c
        JOIN information_schema.CHARACTER_SETS cs ON cs.CHARACTER_SET_NAME = c.CHARACTER_SET_NAME
        ORDER BY c.CHARACTER_SET_NAME, is_default DESC, c.COLLATION_NAME
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $collations = array_map(fn($r) => [
        'collation' => $r['collation'],
        'charset'   => $r['charset'],
        'isDefault' => (bool)$r['is_default'],
    ], $rows);

    jsonOut(['success' => true, 'collations' => $collations]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
