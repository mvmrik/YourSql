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
    $pdo->exec("USE `{$db}`");

    // Columns
    $structure = $pdo->query("SHOW FULL COLUMNS FROM `{$table}`")->fetchAll();

    // Indexes
    $idxRows = $pdo->query("SHOW INDEX FROM `{$table}`")->fetchAll();
    $indexes = [];
    foreach ($idxRows as $r) {
        $name = $r['Key_name'];
        if (!isset($indexes[$name])) {
            $indexes[$name] = [
                'name'    => $name,
                'type'    => $name === 'PRIMARY' ? 'PRIMARY'
                           : ($r['Index_type'] === 'FULLTEXT' ? 'FULLTEXT'
                           : ($r['Non_unique'] == 0 ? 'UNIQUE' : 'INDEX')),
                'columns' => [],
                'method'  => $r['Index_type'],
            ];
        }
        $indexes[$name]['columns'][] = $r['Column_name'];
    }

    // Foreign keys
    $fkStmt = $pdo->prepare("
        SELECT
            kcu.CONSTRAINT_NAME   AS name,
            kcu.COLUMN_NAME       AS col,
            kcu.REFERENCED_TABLE_SCHEMA  AS ref_db,
            kcu.REFERENCED_TABLE_NAME    AS ref_table,
            kcu.REFERENCED_COLUMN_NAME   AS ref_col,
            rc.UPDATE_RULE        AS on_update,
            rc.DELETE_RULE        AS on_delete
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
            ON  rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
            AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
            AND rc.TABLE_NAME        = kcu.TABLE_NAME
        WHERE kcu.TABLE_SCHEMA = :db
          AND kcu.TABLE_NAME   = :tbl
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    ");
    $fkStmt->execute([':db' => $db, ':tbl' => $table]);
    $fkRows = $fkStmt->fetchAll();

    $fks = [];
    foreach ($fkRows as $r) {
        $n = $r['name'];
        if (!isset($fks[$n])) {
            $fks[$n] = [
                'name'      => $n,
                'columns'   => [],
                'ref_db'    => $r['ref_db'],
                'ref_table' => $r['ref_table'],
                'ref_cols'  => [],
                'on_update' => $r['on_update'],
                'on_delete' => $r['on_delete'],
            ];
        }
        $fks[$n]['columns'][]  = $r['col'];
        $fks[$n]['ref_cols'][] = $r['ref_col'];
    }

    jsonOut([
        'success'      => true,
        'structure'    => $structure,
        'indexes'      => array_values($indexes),
        'foreign_keys' => array_values($fks),
    ]);

} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
