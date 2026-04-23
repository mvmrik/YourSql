<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg = requireSession();

jsonOut([
    'success'  => true,
    'host'     => $cfg['host'],
    'port'     => $cfg['port'] ?? 3306,
    'username' => $cfg['username'],
    'database' => $cfg['database'] ?? '',
]);
