import { execSync } from 'node:child_process';
import { E2E_DB } from '../playwright.config';

export default function globalSetup() {
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: E2E_DB, DIRECT_URL: E2E_DB } });
}
