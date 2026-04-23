// ── Breadcrumb ────────────────────────────────────────────────────────────────

function setBreadcrumb(items: BreadcrumbItem[]): void {
    const bc = document.getElementById('breadcrumb')!;
    bc.innerHTML = items.map((item, i) => {
        const sep = i > 0 ? '<span class="crumb-sep">›</span>' : '';
        if (item.onClick) {
            return `${sep}<span class="crumb" style="cursor:pointer;color:var(--accent)" data-idx="${i}">${escHtml(item.label)}</span>`;
        }
        return `${sep}<span class="crumb${item.active ? ' active' : ''}">${escHtml(item.label)}</span>`;
    }).join('');

    items.forEach((item, i) => {
        if (item.onClick) {
            bc.querySelectorAll(`[data-idx="${i}"]`).forEach(el => {
                el.addEventListener('click', item.onClick!);
            });
        }
    });
}

// ── Topbar actions ────────────────────────────────────────────────────────────

function setTopbarActions(actions: TopbarAction[]): void {
    const container = document.getElementById('topbar-actions')!;
    container.innerHTML = '';

    document.addEventListener('click', closeAllDropdowns, { capture: true });

    actions.forEach((a, i) => {
        if (a.dropdown) {
            const wrap = document.createElement('div');
            wrap.className = 'topbar-dropdown-wrap';
            wrap.innerHTML = `
                <button class="btn btn-default btn-sm topbar-dropdown-btn" data-action-idx="${i}">
                    ${escHtml(a.label)}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="margin-left:2px;opacity:.6">
                        <path d="M2 3.5l3 3 3-3"/>
                    </svg>
                </button>
                <div class="topbar-dropdown-menu" id="tdm-${i}">
                    ${a.dropdown.map((item, j) =>
                        `<button class="topbar-dropdown-item" data-ddidx="${i}" data-itemidx="${j}">${escHtml(item.label)}</button>`
                    ).join('')}
                </div>
            `;

            wrap.querySelector('.topbar-dropdown-btn')!.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                const menu = wrap.querySelector('.topbar-dropdown-menu')!;
                const isOpen = menu.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) menu.classList.add('open');
            });

            a.dropdown.forEach((item, j) => {
                wrap.querySelector(`[data-ddidx="${i}"][data-itemidx="${j}"]`)!
                    .addEventListener('click', () => { closeAllDropdowns(); item.onClick(); });
            });

            container.appendChild(wrap);
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn btn-default btn-sm';
            btn.dataset.actionIdx = String(i);
            btn.textContent = a.label;
            btn.addEventListener('click', a.onClick!);
            container.appendChild(btn);
        }
    });
}

function closeAllDropdowns(): void {
    document.querySelectorAll('.topbar-dropdown-menu.open').forEach(m => m.classList.remove('open'));
}
