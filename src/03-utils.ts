// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str: any): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(str: any): string {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isDateLike(val: string): boolean {
    return /^\d{4}-\d{2}-\d{2}/.test(String(val));
}

function toast(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function setVisible(el: Element | null, visible: boolean): void {
    if (el) (el as HTMLElement).style.display = visible ? '' : 'none';
}
