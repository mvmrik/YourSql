# YourSQL

A lightweight, self-hosted MySQL administration interface — a clean alternative to phpMyAdmin/Adminer with a modern dark UI.

![YourSQL](https://img.shields.io/badge/PHP-8.0+-blue) ![MySQL](https://img.shields.io/badge/MySQL-5.7+-orange)

## Features

- Browse databases and tables via a collapsible sidebar
- Inline cell editing with double-click
- Row insert with duplication from selected rows
- Bulk edit and delete with multi-select
- Filter, sort, and paginate table data
- Table structure editor (add, edit, delete, reorder columns)
- Create new tables
- Import / export SQL and CSV
- SQL query panel with syntax highlighting (CodeMirror)
- Auto-refresh with configurable interval (1s, 5s, 30s, 60s)
- Session-based auth — credentials never stored on disk
- Optional app password gate with 30-day remember-me

## Requirements

- PHP 8.0 or newer with the `pdo_mysql` and `pdo_sqlite` extensions enabled
- MySQL 5.7+ or MariaDB 10.3+
- A web server — Apache or Nginx
- No Composer, no npm, no build step

## Installation

1. Copy the project folder to your web server's document root (or a subdirectory):

```
/var/www/html/yoursql/
```

2. Make sure the `data/` directory inside the project is writable by the web server process:

```bash
chmod 775 data/
# or, if the directory doesn't exist yet:
mkdir -p data && chmod 775 data/
```

3. Open `http://your-server/yoursql/` in a browser — you will see the login screen.

4. Enter your MySQL host, port, username, and password. Credentials are kept only in the PHP session and are never written to disk.

## Auto-login via .env

To skip the login form on every page load, create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your database credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_DATABASE=         # optional — leave empty to browse all databases
```

On next visit the app will connect automatically and redirect straight to the interface.

## App password (optional)

If YourSQL is publicly accessible you can add a password gate that must be passed before anything else loads. Set `APP_PASSWORD` in your `.env`:

```env
APP_PASSWORD=yourpassword
```

- Leave `APP_PASSWORD` empty (or omit it) to disable the gate entirely — useful for local dev.
- The password screen shows a **Remember me for 30 days** checkbox. When checked, a secure `HttpOnly` cookie is set; the visitor won't be asked again for 30 days.
- The password is compared server-side. Only a random token hash is stored in `data/app_remember_tokens.json` for the remember-me cookie — the password itself is never written anywhere.

## Apache virtual host example

```apache
<VirtualHost *:80>
    ServerName yoursql.local
    DocumentRoot /var/www/html/yoursql
    <Directory /var/www/html/yoursql>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Add `127.0.0.1 yoursql.local` to `/etc/hosts` for local use.

## Nginx example

```nginx
server {
    listen 80;
    server_name yoursql.local;
    root /var/www/html/yoursql;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    # Block direct access to sensitive paths
    location ~ /\.(?!well-known).* { deny all; }
    location ^~ /data/ { deny all; }
}
```

## Custom theme

YourSQL supports a server-side custom theme that applies to all browsers and devices — not just the one it was created on.

Open **Settings** (gear icon, top right), adjust any of the 14 color pickers with live preview, then click **Save Custom Theme**. The colors are stored in `data/settings.db` (SQLite) and injected as CSS on every page load.

To remove the custom theme, open Settings and click **Delete Custom Theme** — the app reverts to the last locally selected theme.

> `data/settings.db` is also used for any future per-installation settings.

## Security note

YourSQL is intended for private or trusted-network use. The optional `APP_PASSWORD` adds a first layer of protection for public deployments, but for maximum security also consider HTTPS and server-level HTTP basic auth.

## License

MIT
