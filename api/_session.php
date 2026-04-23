<?php
session_start();

function requireSession(): array {
    if (empty($_SESSION['db_config'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }
    return $_SESSION['db_config'];
}

function getConnection(array $cfg): PDO {
    $dsn = 'mysql:host=' . $cfg['host'] . ';port=' . ($cfg['port'] ?? 3306) . ';charset=utf8mb4';
    if (!empty($cfg['database'])) {
        $dsn .= ';dbname=' . $cfg['database'];
    }
    $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT            => 5,
    ]);
    return $pdo;
}

function jsonOut(array $data): void {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function jsonBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// Replace ? placeholders with quoted values for display only (not for execution)
function interpolateSql(string $sql, array $params): string {
    $i = 0;
    return preg_replace_callback('/\?/', function () use ($params, &$i) {
        $val = $params[$i++] ?? null;
        if ($val === null)              return 'NULL';
        if (is_int($val) || is_float($val)) return (string)$val;
        if (is_bool($val))              return $val ? '1' : '0';
        return "'" . addslashes((string)$val) . "'";
    }, $sql);
}
