<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db  = trim($body['database'] ?? '');
$sql = trim($body['sql']      ?? '');

if (!$sql) {
    jsonOut(['success' => false, 'error' => 'No SQL provided']);
}

try {
    $pdo = getConnection($cfg);
    if ($db) $pdo->exec("USE `{$db}`");

    // Determine query type
    $first = strtoupper(preg_replace('/\s+/', ' ', substr($sql, 0, 10)));
    $isSelect = str_starts_with($first, 'SELECT') || str_starts_with($first, 'SHOW') || str_starts_with($first, 'EXPLAIN') || str_starts_with($first, 'DESC');

    if ($isSelect) {
        $stmt = $pdo->query($sql);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $columns = $rows ? array_keys($rows[0]) : [];
        // Get columns even if no rows
        if (!$columns) {
            $colCount = $stmt->columnCount();
            for ($i = 0; $i < $colCount; $i++) {
                $columns[] = $stmt->getColumnMeta($i)['name'] ?? "col{$i}";
            }
        }
        jsonOut([
            'success' => true,
            'columns' => $columns,
            'rows'    => $rows,
            'sql'     => $sql,
        ]);
    } else {
        $affected = $pdo->exec($sql);
        jsonOut([
            'success'  => true,
            'affected' => $affected === false ? 0 : $affected,
            'sql'      => $sql,
        ]);
    }
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
