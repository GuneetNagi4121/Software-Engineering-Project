/**
 * CampusCycle — Phase 2 browser flow test (optional).
 *
 * Drives the real UI with Playwright:
 *   1. a student reports a CRITICAL issue and sees it in My Reports,
 *   2. the reported cycle disappears from "Find a Bicycle",
 *   3. an admin resolves the report (notes required) and is offered the
 *      return-to-service action,
 *   4. the admin simulates a boundary breach, repeats it, and confirms that a
 *      second alert is NOT created, then resolves the alert.
 *
 * Playwright is deliberately NOT a project dependency. To run this:
 *
 *   cd frontend
 *   npm install --no-save playwright && npx playwright install chromium
 *   # with the backend on :4000 and the frontend on :5175 already running
 *   node tests/ui-flow.mjs
 *
 * It writes against the running database, so point it at a development one.
 */

import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5175';
import fs from 'node:fs';

const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });

const out = [];
let fails = 0;
const check = (c, m) => { out.push(`${c ? '  ✔' : '  ✖'} ${m}`); if (!c) fails++; };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function login(email, password) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { out.push(`  ✖ pageerror: ${e.message}`); fails++; });
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.fill('#email', email);
  await p.fill('#password', password);
  await p.click('button[type=submit]');
  await p.waitForURL(/\/(app|admin)/);
  await p.waitForTimeout(800);
  return { ctx, p };
}

out.push('UI flow — student reports a critical issue');
const { ctx: sCtx, p: student } = await login('sneha@campuscycle.edu', 'Student@123');
await student.goto(`${BASE}/app/find`, { waitUntil: 'networkidle' });
await student.waitForTimeout(800);
const firstCode = await student.locator('.font-mono').first().innerText();
check(!!firstCode, `an available cycle is listed (${firstCode})`);

await student.goto(`${BASE}/app/report`, { waitUntil: 'networkidle' });
await student.waitForTimeout(800);
// Pick the cycle whose QR we just read.
await student.fill('#qr', firstCode);
await student.click('button:has-text("Find")');
await student.waitForTimeout(600);
await student.selectOption('#category', 'BRAKES');
await student.selectOption('#severity', 'CRITICAL');
await student.fill('#description', 'Front brake cable snapped during the ride.');
const warn = await student.locator('text=taken out of service for inspection').first().isVisible();
check(warn, 'the form warns that a critical report takes the cycle out of service');
await student.click('button[type=submit]:has-text("Submit report")');
await student.waitForTimeout(600);
const dialog = await student.locator('[role=dialog]').isVisible();
check(dialog, 'a confirmation dialog appears before submitting');
await student.click('[role=dialog] button:has-text("Submit report")');
await student.waitForURL(/\/app\/reports/, { timeout: 10000 });
await student.waitForTimeout(1000);
const listed = await student.locator('text=Front brake cable snapped').first().isVisible();
check(listed, 'the report appears in My Reports');
const openBadge = await student.locator('text=Open').first().isVisible();
check(openBadge, 'the new report shows as Open');
await student.screenshot({ path: SHOTS + 'student-reports.png', fullPage: true });

// The cycle must no longer be offered on Find a Bicycle.
await student.goto(`${BASE}/app/find`, { waitUntil: 'networkidle' });
await student.waitForTimeout(900);
const stillOffered = await student.locator(`text=${firstCode}`).count();
check(stillOffered === 0, 'the reported cycle is no longer offered for rental');

out.push('');
out.push('UI flow — admin handles the report and simulates a boundary breach');
const { ctx: aCtx, p: admin } = await login('admin@campuscycle.edu', 'Admin@123');
await admin.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await admin.waitForTimeout(900);
const banner = await admin.locator('text=maintenance').first().isVisible();
check(banner, 'the admin overview surfaces open maintenance work');

await admin.goto(`${BASE}/admin/maintenance`, { waitUntil: 'networkidle' });
await admin.waitForTimeout(900);
await admin.click('table tbody tr:first-child button:has-text("Manage")');
await admin.waitForTimeout(700);
await admin.selectOption('#status', 'RESOLVED');
await admin.click('[role=dialog] button:has-text("Update status")');
await admin.waitForTimeout(700);
const notesRequired = await admin.locator('text=Explain what was done before closing').isVisible();
check(notesRequired, 'resolving without notes is blocked in the UI');
await admin.fill('#notes', 'Brake cable replaced and road-tested.');
await admin.click('[role=dialog] button:has-text("Update status")');
await admin.waitForTimeout(1200);
const canReturn = await admin.locator('text=No safety issues remain').isVisible();
check(canReturn, 'the UI offers to return the cleared cycle to service');
await admin.screenshot({ path: SHOTS + 'admin-resolve.png', fullPage: true });
await admin.click('[role=dialog] button:has-text("Close")');
await admin.waitForTimeout(400);

await admin.goto(`${BASE}/admin/geofence`, { waitUntil: 'networkidle' });
await admin.waitForTimeout(900);
await admin.selectOption('#sim-bike', { index: 1 });
await admin.click('button:has-text("Use a point outside")');
await admin.click('button:has-text("Submit simulated location")');
await admin.waitForTimeout(1400);
const violation = await admin.locator('text=Outside the boundary').first().isVisible();
check(violation, 'submitting an outside point reports a violation');
// Count only OPEN alerts, so the assertion holds on a database that already
// has resolved alerts from an earlier run.
await admin.selectOption('#alert-status', 'OPEN');
await admin.waitForTimeout(1000);
const alertRows1 = await admin.locator('table tbody tr').count();
check(alertRows1 === 1, `one open alert is listed (got ${alertRows1})`);

await admin.click('button:has-text("Submit simulated location")');
await admin.waitForTimeout(1400);
const alertRows2 = await admin.locator('table tbody tr').count();
check(alertRows2 === 1, `a repeated breach does not create a second alert (got ${alertRows2})`);
const pings = await admin.locator('table tbody tr:first-child td').nth(3).innerText();
check(pings.trim() === '2', `the alert counts both updates (got ${pings.trim()})`);
await admin.screenshot({ path: SHOTS + 'admin-geofence.png', fullPage: true });

await admin.click('button:has-text("Use a point inside")');
await admin.click('button:has-text("Submit simulated location")');
await admin.waitForTimeout(1400);
const backInside = await admin.locator('text=Inside the boundary').first().isVisible();
check(backInside, 'an inside point reports no violation');
const stillOpen = await admin
  .locator('table tbody tr:first-child')
  .innerText()
  .catch(() => '(no rows)');
check(/Open/.test(stillOpen), 'the alert stays open until an admin closes it');

await admin.click('table tbody tr:first-child button:has-text("Manage")');
await admin.waitForTimeout(700);
await admin.fill('#alert-notes', 'Cycle recovered from the main gate.');
await admin.click('[role=dialog] button:has-text("Resolve")');
await admin.waitForTimeout(1400);
// The list is still filtered to OPEN, so a resolved alert should drop out of it.
const remainingOpen = await admin.locator('table tbody tr').count();
check(remainingOpen === 0, 'the resolved alert leaves the open list');
await admin.selectOption('#alert-status', 'RESOLVED');
await admin.waitForTimeout(1000);
const resolved = await admin.locator('table tbody tr:first-child').innerText();
check(/Resolved/.test(resolved), 'the alert can be resolved from the UI');

await sCtx.close();
await aCtx.close();
await b.close();
console.log(out.join('\n'));
console.log(`\n${out.filter((l) => l.startsWith('  ✔')).length} passed, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
