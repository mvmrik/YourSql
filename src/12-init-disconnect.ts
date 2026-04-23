// ── Disconnect ────────────────────────────────────────────────────────────────

document.getElementById('btn-disconnect')!.addEventListener('click', async () => {
    await fetch('api/disconnect.php', { method: 'POST' });
    window.location.href = 'index.php';
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
    try {
        const data = await api('session');
        if (!data) return;

        document.getElementById('server-label')!.textContent =
            (data.host || 'localhost') + (data.port && data.port !== 3306 ? ':' + data.port : '');
        if (data.username) {
            document.getElementById('server-user')!.textContent = data.username;
        }

        await loadDatabases();
    } catch (err) {
        window.location.href = 'index.php';
    }
}
