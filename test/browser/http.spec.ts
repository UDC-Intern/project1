import { test, expect, type Page } from '@playwright/test';

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

test('orang tua mendaftar dan membaca data keluarga melalui HTTP', async ({ page, request }) => {
  const problems = watch(page);
  const email = `browser-parent-${Date.now()}@example.test`;
  await page.goto('/orang-tua/daftar');
  await page.getByLabel('Nama kamu', { exact: true }).fill('Orang Tua Browser');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page
    .getByLabel('Kata sandi (minimal 8 karakter)', { exact: true })
    .fill('browser-password-123');
  await page.getByRole('checkbox').check();
  const registration = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/parent/register') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const response = await registration;
  const account = (await response.json()) as { token: string; user: { familyCode: string } };
  expect(response.status(), JSON.stringify(account)).toBe(201);
  await expect(page).toHaveURL(/\/orang-tua$/);
  const child = await request.post('/api/parent/children', {
    headers: { Authorization: `Bearer ${account.token}` },
    data: { nickname: 'Anak Browser', momoColor: 'blue', pin: ['apple', 'star', 'fish'] },
  });
  expect(child.ok()).toBe(true);
  const data = (await child.json()) as { id: string };
  // Sesi lama belum menyimpan kode per akun, sedangkan browser mungkin mengingat kode keluarga lain.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('udakids-session-v1')!);
    delete stored.familyCode;
    localStorage.setItem('udakids-session-v1', JSON.stringify(stored));
    localStorage.setItem('udakids.familyCode', 'BELAJF');
  });
  await page.reload();
  await expect(page.getByRole('status', { name: 'Kode keluarga' })).toHaveText(
    account.user.familyCode,
  );
  await page.locator('.pa-side-play').click();
  await expect(page.getByRole('button', { name: 'Anak Browser' })).toBeVisible();
  await expect(page.getByLabel('Kode keluarga', { exact: true })).toHaveCount(0);
  for (const path of [
    '/orang-tua',
    '/orang-tua/paket',
    '/orang-tua/transaksi',
    '/orang-tua/sertifikat',
    '/orang-tua/akun',
    `/orang-tua/anak/${data.id}`,
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('main'),
      `${path} -> ${page.url()} | ${await page.locator('body').innerText()} | ${problems.join('; ')}`,
    ).toBeVisible();
  }
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/orang-tua');
    await expect(page.getByText('Anak Browser', { exact: true }).first()).toBeVisible();
    expect(await page.locator('body').evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(
      false,
    );
    await page.screenshot({ path: `test-results/orang-tua-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await page.goto('/orang-tua/masuk');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel(/Kata sandi/).fill('browser-password-123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Kode keluarga' })).toHaveText(
    account.user.familyCode,
  );
  await page.locator('.pa-side-play').click();
  await expect(page.getByRole('button', { name: 'Anak Browser' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('admin membuka setiap menu dengan API dan dialog sertifikat', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/masuk/staf');
  await page.getByLabel('Email', { exact: true }).fill('browser-admin@example.test');
  await page.getByLabel(/Kata sandi/).fill('browser-password-123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Perjalanan keluarga')).toBeVisible();
  const revenueHeading = page.getByRole('heading', { name: 'Pendapatan' });
  await revenueHeading.scrollIntoViewIfNeeded();
  const revenuePanel = page.locator('section').filter({ has: revenueHeading }).first();
  const firstDay = revenuePanel.locator('g[role="button"]').first();
  await firstDay.hover();
  await expect(page.getByRole('tooltip')).toContainText('pesanan');
  await expect(page.getByRole('tooltip')).toContainText('Rp');
  const activityHeading = page.getByRole('heading', { name: 'Aktivitas belajar' });
  await activityHeading.scrollIntoViewIfNeeded();
  const activityPanel = page.locator('section').filter({ has: activityHeading }).first();
  await activityPanel.locator('g[role="button"]').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('Rata-rata');
  for (const path of [
    '/admin',
    '/admin/konten',
    '/admin/soal',
    '/admin/sertifikat',
    '/admin/galeri',
    '/admin/narasi',
    '/admin/ilustrasi',
    '/admin/keluarga',
    '/admin/staf',
    '/admin/laporan',
    '/admin/transaksi',
    '/admin/paket',
    '/admin/rekening',
    '/admin/pengaturan',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('main'),
      `${path} -> ${page.url()} | ${await page.locator('body').innerText()} | ${problems.join('; ')}`,
    ).toBeVisible();
  }
  await page.goto('/admin/staf');
  const staffPassword = page.getByLabel('Password', { exact: true });
  await expect(staffPassword).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Tampilkan password' }).click();
  await expect(staffPassword).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Sembunyikan password' }).click();
  await expect(staffPassword).toHaveAttribute('type', 'password');
  await page.goto('/admin/sertifikat');
  await page.getByRole('button', { name: /Atur isi lembar/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialog = page.getByRole('dialog');
  const sheet = dialog.locator('.adm-cert-preview svg');
  await expect(sheet.getByText('Ayu Lestari')).toBeVisible();
  await dialog.getByLabel('Pakai nama lengkap dari orang tua').uncheck();
  await expect(sheet.getByText('Ayu', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Ayu Lestari')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/editor-sertifikat.png', fullPage: true });
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    expect(await page.locator('body').evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(
      false,
    );
    await page.screenshot({ path: `test-results/admin-${width}.png`, fullPage: true });
  }
  expect(problems).toEqual([]);
});

test('anak masuk dengan sandi gambar dan membuka ronde server', async ({ page, request }) => {
  const problems = watch(page);
  const registered = await request.post('/api/auth/parent/register', {
    data: {
      name: 'Keluarga Anak',
      email: `browser-child-${Date.now()}@example.test`,
      password: 'browser-password-123',
      consent: true,
    },
  });
  const parent = (await registered.json()) as { token: string; user: { familyCode: string } };
  expect(registered.status(), JSON.stringify(parent)).toBe(201);
  const child = await request.post('/api/parent/children', {
    headers: { Authorization: `Bearer ${parent.token}` },
    data: { nickname: 'Citra Browser', momoColor: 'green', pin: ['apple', 'star', 'fish'] },
  });
  expect(child.ok(), await child.text()).toBe(true);
  await page.goto('/play/masuk');
  await page.getByLabel('Kode keluarga', { exact: true }).fill(parent.user.familyCode);
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByRole('button', { name: 'Citra Browser' }).click();
  for (const name of ['Apel', 'Bintang', 'Ikan'])
    await page.getByRole('button', { name, exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  for (const path of [
    '/play',
    '/play/peringkat',
    '/play/profil',
    '/play/sertifikat/matematika-kelas-1',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeVisible();
  }
  const adminLogin = await request.post('/api/auth/staff/login', {
    data: { email: 'browser-admin@example.test', password: 'browser-password-123' },
  });
  const admin = (await adminLogin.json()) as { token: string };
  const catalogs = await request.get('/api/admin/catalogs', {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const books = (await catalogs.json()) as {
    topics: { levels: { id: string; source: string }[] }[];
  }[];
  const level = books
    .flatMap((b) => b.topics.flatMap((t) => t.levels))
    .find((l) => l.source === 'auto')!;
  const opening = page.waitForResponse(
    (r) => r.url().endsWith('/api/practice/rounds') && r.request().method() === 'POST',
  );
  await page.goto(`/play/latihan/${level.id}`);
  const opened = await opening;
  expect(opened.status()).toBe(201);
  const round = (await opened.json()) as { questions: unknown[] };
  expect(round.questions).toHaveLength(10);
  expect(JSON.stringify(round)).not.toContain('"answer"');
  await expect(page.getByRole('button', { name: 'Dengarkan soal', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/ronde-http.png', fullPage: true });
  expect(problems).toEqual([]);
});

test('batas anak dari admin langsung memperbarui tab orang tua yang terbuka', async ({
  browser,
  page,
  request,
}) => {
  await page.goto('/orang-tua/daftar');
  await page.getByLabel('Nama kamu', { exact: true }).fill('Keluarga Batas');
  await page.getByLabel('Email', { exact: true }).fill(`browser-limit-${Date.now()}@example.test`);
  await page
    .getByLabel('Kata sandi (minimal 8 karakter)', { exact: true })
    .fill('browser-password-123');
  await page.getByRole('checkbox').check();
  const registration = page.waitForResponse((r) => r.url().endsWith('/api/auth/parent/register'));
  await page.getByRole('button', { name: 'Daftar', exact: true }).click();
  const parent = (await (await registration).json()) as { token: string };
  await expect(page).toHaveURL(/\/orang-tua$/);

  for (const nickname of ['Ayu', 'Bima', 'Caca', 'Danu', 'Eka']) {
    const child = await request.post('/api/parent/children', {
      headers: { Authorization: `Bearer ${parent.token}` },
      data: { nickname, momoColor: 'blue' },
    });
    expect(child.status(), await child.text()).toBe(201);
  }
  await page.reload();
  await expect(page.getByText('5 anak terdaftar (batas 5)')).toBeVisible();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto('/masuk/staf');
  await admin.getByLabel('Email', { exact: true }).fill('browser-admin@example.test');
  await admin.getByLabel(/Kata sandi/).fill('browser-password-123');
  await admin.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.goto('/admin/pengaturan');
  const limit = admin.getByLabel(/Maksimal anak per keluarga/);
  await expect(limit).toHaveValue('5');
  const otherAdmin = await adminContext.newPage();
  await otherAdmin.goto('/admin/pengaturan');
  const otherLimit = otherAdmin.getByLabel(/Maksimal anak per keluarga/);
  await expect(otherLimit).toHaveValue('5');
  await admin.bringToFront();
  await limit.fill('2');
  await limit.locator('xpath=ancestor::form').getByRole('button', { name: 'Simpan' }).click();
  await expect(admin.getByText('Batas anak per keluarga disimpan.')).toBeVisible();
  await expect(otherLimit).toHaveValue('2');
  await page.bringToFront();
  // Chrome headless tidak selalu mengirim event focus saat berpindah browser context.
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/settings'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refreshed;
  await expect(page.getByText('5 anak terdaftar (batas 2)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ayu', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Eka/ }).click();
  await expect(page.getByRole('heading', { name: 'Eka', exact: true })).toBeVisible();

  await admin.bringToFront();
  await limit.fill('5');
  await limit.locator('xpath=ancestor::form').getByRole('button', { name: 'Simpan' }).click();
  await expect(otherLimit).toHaveValue('5');
  await page.bringToFront();
  const restored = page.waitForResponse((r) => r.url().endsWith('/api/settings'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await restored;
  await expect(page.getByText('5 anak terdaftar (batas 5)')).toBeVisible();
  await adminContext.close();
});
