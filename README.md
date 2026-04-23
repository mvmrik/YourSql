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
- SQL query panel with syntax highlighting (CodeMirror)
- Auto-refresh with configurable interval (1s, 5s, 30s, 60s)
- Session-based auth — credentials never stored on disk

## Requirements

- PHP 8.0 or newer with the `pdo_mysql` extension enabled
- MySQL 5.7+ or MariaDB 10.3+
- A web server — Apache or Nginx
- No Composer, no npm, no build step

## Installation

1. Copy the project folder to your web server's document root (or a subdirectory):

```
/var/www/html/yoursql/
```

2. Make sure `mod_rewrite` is enabled if using Apache (only needed if you set up a virtual host with a custom domain).

3. Open `http://your-server/yoursql/` in a browser — you will see the login screen.

4. Enter your MySQL host, port, username, and password. Credentials are kept only in the PHP session and are never written to disk.

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
    index index.html;

    location /api/ {
        try_files $uri $uri/ =404;
    }
}
```

## Security note

YourSQL is intended for local or private network use. Do not expose it to the public internet without additional authentication (e.g. HTTP basic auth at the server level).

## License

MIT
