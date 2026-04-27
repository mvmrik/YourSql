<?php
require __DIR__ . '/_session.php';
$cfg = requireSession();

$database = trim($_GET['database'] ?? '');
$tables   = $_GET['tables']   ?? [];   // [] = all
$mode     = $_GET['mode']     ?? 'full'; // full | structure | data

if (!$database) {
    http_response_code(400);
    echo 'Missing database';
    exit;
}

try {
    $pdo = getConnection(array_merge($cfg, ['database' => $database]));
} catch (PDOException $e) {
    http_response_code(500);
    echo 'Connection error: ' . $e->getMessage();
    exit;
}

// Fetch all tables if none specified
if (empty($tables)) {
    $stmt = $pdo->query('SHOW TABLES');
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
}

$filename = $database . '_' . date('Ymd_His') . '.sql';

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('X-Accel-Buffering: no'); // Disable nginx buffering
header('Cache-Control: no-cache');

// Disable output buffering entirely
while (ob_get_level()) ob_end_clean();

$out = fopen('php://output', 'w');

function writeln(string $line = ''): void {
    global $out;
    fwrite($out, $line . "\n");
    flush();
}

writeln('-- YourSQL Export');
writeln('-- Database: ' . $database);
writeln('-- Date: ' . date('Y-m-d H:i:s'));
writeln('-- Mode: ' . $mode);
writeln('');
writeln('SET FOREIGN_KEY_CHECKS=0;');
writeln('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
writeln('SET NAMES utf8mb4;');
writeln('');

foreach ($tables as $table) {
    $table = (string)$table;

    writeln('-- --------------------------------------------------------');
    writeln('-- Table: `' . $table . '`');
    writeln('-- --------------------------------------------------------');
    writeln('');

    // Structure
    if ($mode === 'full' || $mode === 'structure') {
        writeln('DROP TABLE IF EXISTS `' . $table . '`;');

        $row = $pdo->query('SHOW CREATE TABLE `' . $table . '`')->fetch(PDO::FETCH_NUM);
        writeln($row[1] . ';');
        writeln('');
    }

    // Data
    if ($mode === 'full' || $mode === 'data') {
        $stmt = $pdo->query('SELECT * FROM `' . $table . '`');
        $stmt->execute();

        $cols = null;
        $batch = [];
        $batchSize = 200;

        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            if ($cols === null) {
                $colStmt = $pdo->query('SHOW COLUMNS FROM `' . $table . '`');
                $cols = $colStmt->fetchAll(PDO::FETCH_COLUMN);
                $colList = '`' . implode('`, `', $cols) . '`';
            }

            $vals = array_map(function ($v) use ($pdo) {
                if ($v === null) return 'NULL';
                if (is_numeric($v) && !preg_match('/^0\d/', $v)) return $v;
                return $pdo->quote($v);
            }, $row);

            $batch[] = '(' . implode(', ', $vals) . ')';

            if (count($batch) >= $batchSize) {
                writeln('INSERT INTO `' . $table . '` (' . $colList . ') VALUES');
                writeln(implode(",\n", $batch) . ';');
                writeln('');
                $batch = [];
            }
        }

        if (!empty($batch)) {
            writeln('INSERT INTO `' . $table . '` (' . $colList . ') VALUES');
            writeln(implode(",\n", $batch) . ';');
            writeln('');
        }
    }
}

writeln('SET FOREIGN_KEY_CHECKS=1;');
writeln('-- End of export');

fclose($out);
