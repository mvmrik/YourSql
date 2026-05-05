<?php
// Shared SQLite settings database helper

function getSettingsDb(): PDO {
    $path = __DIR__ . '/../data/settings.db';
    $pdo  = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )");
    return $pdo;
}

function getSetting(string $key, string $default = ''): string {
    $db  = getSettingsDb();
    $row = $db->prepare('SELECT value FROM settings WHERE key = ?');
    $row->execute([$key]);
    $r = $row->fetch(PDO::FETCH_ASSOC);
    return $r ? $r['value'] : $default;
}

function setSetting(string $key, string $value): void {
    $db = getSettingsDb();
    $db->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
       ->execute([$key, $value]);
}

function deleteSetting(string $key): void {
    $db = getSettingsDb();
    $db->prepare('DELETE FROM settings WHERE key = ?')->execute([$key]);
}

function getAllSettings(): array {
    $db   = getSettingsDb();
    $rows = $db->query('SELECT key, value FROM settings')->fetchAll(PDO::FETCH_ASSOC);
    $out  = [];
    foreach ($rows as $r) $out[$r['key']] = $r['value'];
    return $out;
}
