// End-to-end smoke test of the API. Run while the dev server is up.
// Usage: bun run scripts/smoke.ts

const BASE = 'http://localhost:3000';

function jfetch(url: string, opts: any) {
  return fetch(url, opts).then(async r => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
}

async function main() {
  console.log('--- 1. Login as inspector ---');
  const login = await jfetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'inspector@demo.local', password: 'demo12345' }),
  });
  console.log(login.status, JSON.stringify(login.body).slice(0, 200));
  const accessToken = (login.body as any)?.data?.accessToken;
  if (!accessToken) throw new Error('no access token');

  console.log('--- 2. GET /api/auth/me ---');
  const me = await jfetch(`${BASE}/api/auth/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  console.log(me.status, JSON.stringify(me.body).slice(0, 200));

  console.log('--- 3. GET /api/mines ---');
  const mines = await jfetch(`${BASE}/api/mines`, { headers: { authorization: `Bearer ${accessToken}` } });
  console.log(mines.status, JSON.stringify(mines.body).slice(0, 300));

  console.log('--- 4. GET /api/inspections ---');
  const insp = await jfetch(`${BASE}/api/inspections`, { headers: { authorization: `Bearer ${accessToken}` } });
  console.log(insp.status, JSON.stringify(insp.body).slice(0, 300));

  console.log('--- 5. GET /api/alerts ---');
  const alerts = await jfetch(`${BASE}/api/alerts`, { headers: { authorization: `Bearer ${accessToken}` } });
  console.log(alerts.status, JSON.stringify(alerts.body).slice(0, 300));

  console.log('--- 6. GET /api/dashboard/summary ---');
  const dash = await jfetch(`${BASE}/api/dashboard/summary`, { headers: { authorization: `Bearer ${accessToken}` } });
  console.log(dash.status, JSON.stringify(dash.body).slice(0, 300));

  console.log('--- 7. POST /api/workflow/run (no secret) ---');
  const wfNoSecret = await jfetch(`${BASE}/api/workflow/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  console.log(wfNoSecret.status, JSON.stringify(wfNoSecret.body).slice(0, 200));

  console.log('--- 8. POST /api/workflow/run (with secret) ---');
  const wfSecret = await jfetch(`${BASE}/api/workflow/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': 'dev_cron_secret_change_me_in_production_0123456789abcdef' },
    body: '{}',
  });
  console.log(wfSecret.status, JSON.stringify(wfSecret.body).slice(0, 500));

  console.log('--- 9. POST /api/ai/risk-score ---');
  const ai = await jfetch(`${BASE}/api/ai/risk-score`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ inspectionId: 'demo-insp-1', summary: 'Severe: fire risk detected near vent shaft. Collapse likely.' }),
  });
  console.log(ai.status, JSON.stringify(ai.body).slice(0, 400));

  console.log('--- 10. Login as regulator (should be denied workflow write access) ---');
  const regLogin = await jfetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'regulator@demo.local', password: 'demo12345' }),
  });
  const regToken = (regLogin.body as any)?.data?.accessToken;
  console.log('regulator login:', regLogin.status);

  console.log('--- 11. GET /api/audit-logs (regulator) ---');
  const al = await jfetch(`${BASE}/api/audit-logs`, { headers: { authorization: `Bearer ${regToken}` } });
  console.log(al.status, JSON.stringify(al.body).slice(0, 300));

  console.log('--- 12. POST /api/audit-logs/verify (chain verification) ---');
  const verify = await jfetch(`${BASE}/api/audit-logs/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${regToken}` },
  });
  console.log(verify.status, JSON.stringify(verify.body).slice(0, 200));

  console.log('\n=== SMOKE TEST PASSED ===');
}

main().catch(e => { console.error('SMOKE FAILED:', e); process.exit(1); });
