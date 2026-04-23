const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const btnText = loginBtn.querySelector('.btn-text');
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
        const res = await fetch('api/connect.php', {
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
    } catch (err) {
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
