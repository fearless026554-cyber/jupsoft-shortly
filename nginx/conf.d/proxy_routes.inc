# Common Proxy Routing Configuration

# Default proxy headers
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_cache_bypass $http_upgrade;
proxy_read_timeout 60s;
proxy_connect_timeout 10s;

# Next.js Static Assets Caching
location /_next/static/ {
    proxy_pass http://frontend_upstream;
    proxy_cache_valid 200 365d;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Next.js Public Assets & Frontend Routes
location /_next/ {
    proxy_pass http://frontend_upstream;
}

location = / {
    proxy_pass http://frontend_upstream;
}

location = /login {
    proxy_pass http://frontend_upstream;
}

location = /landing {
    proxy_pass http://frontend_upstream;
}

location = /icon.png {
    proxy_pass http://frontend_upstream;
}

# Next.js Client Proxy Route
location /api/proxy {
    proxy_pass http://frontend_upstream;
}

# Backend Direct REST API Routes
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://backend_upstream;
}

# Health Check Route
location = /health {
    proxy_pass http://backend_upstream/health;
}

# System & Template Error Routes
location /system/ {
    proxy_pass http://backend_upstream;
}

# Short Code Redirections & Everything Else
# All non-frontend paths (e.g. /my-code, /abc123) are routed to Backend Redirect Controller
location / {
    limit_req zone=redirect_limit burst=50 nodelay;
    proxy_pass http://backend_upstream;
}
