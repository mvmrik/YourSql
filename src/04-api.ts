// ── API helper ────────────────────────────────────────────────────────────────

async function api(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const url = 'api/' + endpoint + '.php';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (res.status === 401) {
        window.location.href = 'index.php';
        return null;
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    if (data.sql) setSqlPanel(data.sql);
    return data;
}
