## Description
<!-- Provide a concise summary of the purpose and changes introduced in this PR -->

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🔒 Security fix / Compliance update
- [ ] ⚡ Performance optimization
- [ ] ♻️ Refactoring / Code cleanup
- [ ] 📝 Documentation update

## Affected Components
- [ ] `backend-nestjs` (API, Database, Workers, Redis)
- [ ] `frontend` (Next.js UI, Views, Components)
- [ ] `deploy` (Docker Compose, Nginx, PM2, Scripts)
- [ ] `.github` (CI/CD Workflows, Security Policies)

## Enterprise Security & Quality Checklist
- [ ] **No Hardcoded Secrets:** Verified that no API keys, private certificates, or production credentials are included.
- [ ] **RBAC & Authorization:** All new/updated endpoints enforce proper role and scope checks (`AuthGuard`, `RequireScope`).
- [ ] **Data Isolation (RLS):** Tenant boundaries are respected via proper tenant context queries.
- [ ] **Tests Added / Updated:** Unit tests or regression tests have been executed.
- [ ] **Typecheck Passed:** `pnpm run typecheck` passes with zero errors.
- [ ] **Lint Clean:** `pnpm run lint` passes without violations.

## Testing Instructions
<!-- Provide reproduction steps or instructions to verify this change -->
1. ...
2. ...
