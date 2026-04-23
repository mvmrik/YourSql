<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

session_destroy();
jsonOut(['success' => true]);
