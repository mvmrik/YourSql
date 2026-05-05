<?php
require __DIR__ . '/_session.php';
require __DIR__ . '/_settings_db.php';
header('Content-Type: application/json');

requireSession();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    jsonOut(['success' => true, 'settings' => getAllSettings()]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $action = $body['action'] ?? '';

    if ($action === 'set') {
        $pairs = $body['pairs'] ?? [];
        if (!is_array($pairs)) jsonOut(['success' => false, 'error' => 'pairs must be an object']);
        foreach ($pairs as $key => $value) {
            setSetting((string)$key, (string)$value);
        }
        jsonOut(['success' => true]);
    }

    if ($action === 'delete') {
        $keys = $body['keys'] ?? [];
        if (!is_array($keys)) jsonOut(['success' => false, 'error' => 'keys must be an array']);
        foreach ($keys as $key) deleteSetting((string)$key);
        jsonOut(['success' => true]);
    }

    jsonOut(['success' => false, 'error' => 'Unknown action']);
}

jsonOut(['success' => false, 'error' => 'Method not allowed']);
