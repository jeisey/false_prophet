import { test, expect } from '@playwright/test';
import { boot, fp, startViaMenus } from './helpers';

const MEMBERS = ['lead', 'rhythm', 'bass', 'drums', 'vocals'];

test('title, lineup and how-to render without errors', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('.logo .fp')).toHaveText('FALSE PROPHET');
  await page.locator('[data-act=howto]').click();
  await expect(page.locator('.howto .step')).toHaveCount(6);
  await page.locator('[data-act=back]').click();
  await page.locator('.plate.big').click();
  await expect(page.locator('.card')).toHaveCount(5);
  for (const m of MEMBERS) {
    await page.locator(`.card[data-id=${m}]`).click();
    await expect(page.locator(`.card[data-id=${m}]`)).toHaveAttribute('aria-checked', 'true');
  }
  expect(errors).toEqual([]);
});

for (const member of MEMBERS) {
  test(`${member} can start a run; clock at 18:00, only their stem audible`, async ({ page }) => {
    const errors = await boot(page);
    await startViaMenus(page, member);
    const st = await fp<any>(page, 'state');
    expect(st.band).toEqual([member]);
    expect(st.timeRemaining).toBeGreaterThan(1075);
    expect(st.sites.map((s: any) => s.member).sort()).toEqual(MEMBERS.filter((m) => m !== member).sort());
    const au = await fp<any>(page, 'audio');
    expect(au.status).toBe('running');
    expect(au.audible).toEqual([member]);
    expect(errors).toEqual([]);
  });
}

test('rescues layer stems onto the same transport, one bar line at a time', async ({ page }) => {
  await boot(page);
  await startViaMenus(page, 'vocals');
  const origin = (await fp<any>(page, 'audio')).origin;
  let expected = ['vocals'];
  for (let i = 0; i < 4; i++) {
    const before = await fp<any>(page, 'audio');
    await fp(page, 'rescue');
    const st = await fp<any>(page, 'state');
    expected = st.band;
    // gain change is scheduled on a future bar line of the shared transport
    const after = await fp<any>(page, 'audio');
    expect(after.origin).toBe(origin);
    expect(after.active.sort()).toEqual([...expected].sort());
    expect(after.bar).toBeGreaterThanOrEqual(before.bar);
    await page.waitForTimeout(2600);
  }
  const final = await fp<any>(page, 'audio');
  expect(final.audible.sort()).toEqual([...MEMBERS].sort());
  expect(final.origin).toBe(origin);
  const st = await fp<any>(page, 'state');
  expect(st.fullBand).toBe(true);
  expect(st.breakdownMeter).toBeGreaterThan(0);
  expect(st.spire).toBe('open');
});

test('pausing freezes the countdown and the page', async ({ page }) => {
  await boot(page);
  await startViaMenus(page, 'lead');
  await page.keyboard.press('Escape');
  await expect(page.locator('.screen.pause')).toBeVisible();
  const t1 = (await fp<any>(page, 'state')).timeRemaining;
  await page.waitForTimeout(2500);
  const t2 = (await fp<any>(page, 'state')).timeRemaining;
  expect(t2).toBe(t1);
  await page.locator('[data-act=resume]').click();
  await page.waitForTimeout(1500);
  const t3 = (await fp<any>(page, 'state')).timeRemaining;
  expect(t3).toBeLessThan(t2);
});

test('level-up offers three pedals and the choice changes the run', async ({ page }) => {
  await boot(page);
  await startViaMenus(page, 'drums');
  await fp(page, 'addXp', 20);
  await expect(page.locator('.pedal')).toHaveCount(3);
  const id = await page.locator('.pedal').first().getAttribute('data-id');
  await page.waitForTimeout(400);
  await page.locator('.pedal').first().click();
  await expect(page.locator('.pedal')).toHaveCount(0);
  const st = await fp<any>(page, 'state');
  expect(st.upgrades[id!]).toBe(1);
});

test('the clock reaching 00:00 ends the run: HARVEST COMPLETE', async ({ page }) => {
  await boot(page);
  await startViaMenus(page, 'bass');
  await fp(page, 'god', true);
  await fp(page, 'setTime', 1.2);
  await expect(page.locator('.results .big')).toContainText('HARVEST', { timeout: 15_000 });
  const st = await fp<any>(page, 'state');
  expect(st.phase).toBe('defeat');
  expect(st.clock).toBe('00:00');
});

test('boss defeat + reaching the portal wins the run', async ({ page }) => {
  await boot(page);
  await startViaMenus(page, 'rhythm');
  await fp(page, 'god', true);
  for (let i = 0; i < 4; i++) {
    await fp(page, 'rescue');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2500);
  const spire = await page.evaluate(() => (window as any).__FP__.spirePos());
  await fp(page, 'teleport', spire.x, spire.y + 150);
  await expect.poll(async () => (await fp<any>(page, 'state')).spire, { timeout: 20_000 }).toBe('fight');
  await page.waitForTimeout(2000);
  for (let i = 0; i < 8; i++) {
    await fp(page, 'killAnchors');
    await fp(page, 'damageBoss', 0.3);
    await page.waitForTimeout(700);
  }
  await expect.poll(async () => (await fp<any>(page, 'state')).spire, { timeout: 20_000 }).toBe('escape');
  const portal = await page.evaluate(() => (window as any).__FP__.portalPos());
  await fp(page, 'teleport', portal.x, portal.y + 20);
  await expect(page.locator('.results .big')).toContainText('REUNITED', { timeout: 20_000 });
  expect((await fp<any>(page, 'state')).phase).toBe('victory');
});

test('settings and best score survive a refresh', async ({ page }) => {
  await boot(page);
  await page.locator('[data-act=settings]').click();
  await page.locator('#vol-music').fill('23');
  await page.locator('[data-toggle=reducedShake]').click();
  await page.reload();
  await expect(page.locator('.plate.big')).toBeVisible({ timeout: 30_000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fp-breakdown.settings.v1') ?? '{}'));
  expect(stored.musicVolume).toBeCloseTo(0.23, 2);
  expect(stored.reducedShake).toBe(true);
  await page.locator('[data-act=settings]').click();
  await expect(page.locator('#vol-music')).toHaveValue('23');
  await expect(page.locator('[data-toggle=reducedShake]')).toHaveAttribute('aria-pressed', 'true');
});

test('mobile layout: no page scroll, HUD fits the viewport', async ({ page }) => {
  await boot(page);
  await startViaMenus(page, 'lead');
  const m = await page.evaluate(() => ({
    sh: document.scrollingElement!.scrollHeight,
    sw: document.scrollingElement!.scrollWidth,
    ih: innerHeight,
    iw: innerWidth,
    canvas: document.querySelector('#game canvas')!.getBoundingClientRect().toJSON(),
  }));
  expect(m.sh).toBeLessThanOrEqual(m.ih);
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(Math.round(m.canvas.width)).toBe(m.iw);
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
