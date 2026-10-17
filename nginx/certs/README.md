# Nginx SSL Certificates Directory

> **SECURITY NOTICE:** Do NOT commit `.key`, `.crt`, or `.pem` files to Git.

### Production Deployment
In production, SSL certificates should be provisioned dynamically via Let's Encrypt / Certbot, or mounted via container volumes from a secure secrets store:
- `/etc/nginx/certs/server.crt`
- `/etc/nginx/certs/server.key`

### Local Development TLS (Self-Signed)
If running HTTPS locally with Nginx, generate local self-signed certificates using OpenSSL:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/CN=localhost"
```
These generated files will automatically be ignored by `.gitignore`.
