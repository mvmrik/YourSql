// ── App-password screen ───────────────────────────────────────────────────────
const appPasswordForm = document.getElementById('app-password-form');
if (appPasswordForm) {
    const btn       = document.getElementById('app-password-btn');
    const btnText   = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const errorBox  = document.getElementById('app-password-error');

    appPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        errorBox.classList.add('hidden');

        const password = document.getElementById('app-password').value;
        const remember = document.getElementById('app-remember').checked;

        try {
            const res  = await fetch('api/verify_app_password.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, remember }),
            });
            const data = await res.json();

            if (data.success) {
                window.location.reload();
            } else {
                errorBox.textContent = data.error || 'Incorrect password';
                errorBox.classList.remove('hidden');
                btn.disabled = false;
                btnText.classList.remove('hidden');
                btnLoader.classList.add('hidden');
            }
        } catch {
            errorBox.textContent = 'Network error';
            errorBox.classList.remove('hidden');
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    });
}

// ── DB login form ─────────────────────────────────────────────────────────────
const form = document.getElementById('login-form');
if (form) {
    const errorBox = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    const btnText  = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);
        hideError();

        const payload = {
            host:     document.getElementById('host').value.trim() || 'localhost',
            port:     parseInt(document.getElementById('port').value) || 3306,
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value,
            database: document.getElementById('database').value.trim(),
        };

        try {
            const res  = await fetch('api/connect.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (data.success) {
                window.location.href = 'app.php';
            } else {
                showError(data.error || 'Connection failed');
            }
        } catch {
            showError('Network error — could not reach the server');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(state) {
        loginBtn.disabled = state;
        btnText.classList.toggle('hidden', state);
        btnLoader.classList.toggle('hidden', !state);
    }

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
    }

    function hideError() {
        errorBox.classList.add('hidden');
    }
}
