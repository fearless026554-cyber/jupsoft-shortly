# Security Policy

## Supported Versions

Only the latest release running on the `main` branch receives active security updates and vulnerability patches.

| Version | Supported          |
| ------- | ------------------ |
| 1.x / `main` | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The security and privacy of our enterprise users is of paramount importance. If you discover a security vulnerability or potential leak within this codebase or deployment infrastructure, please report it privately rather than creating a public issue.

### Security Contact
- **Email:** `security@jupsoft.com`
- **PGP Key:** Available upon request or via company security portal.
- **Subject Line:** `[SECURITY-VULNERABILITY] Jupsoft Shortly - <Short Description>`

### Information to Include
To help us triage and resolve the issue quickly, please provide:
1. Type of issue (e.g. Broken Object Level Authorization, Privilege Escalation, Remote Code Execution, Secret Exposure).
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. The affected component (`backend-nestjs`, `frontend`, `nginx`, or deployment configs).
4. Any potential mitigations you have identified.

### Response Timelines (SLA)
- **Initial Acknowledgment:** Within 24 hours.
- **Triage & Severity Assessment:** Within 48 hours.
- **Status Updates:** Every 72 hours until resolution.
- **Patch Deployment:** Critical severity patches are deployed within 7 business days.

## Enterprise Security Controls

This repository adheres to standard Enterprise Security Best Practices:
- **Zero Hardcoded Secrets:** All credentials, keys, and tokens must be loaded via runtime environment variables.
- **No Private Keys in Git:** SSL/TLS private keys (`*.key`, `*.pem`) are strictly excluded from version control.
- **Automated Scanning:** Pull requests and pushes are checked with automated Secret Scanning (Gitleaks) and Dependency Audits.
- **Least Privilege RBAC:** Access control is strictly role-based and claims-verified.
