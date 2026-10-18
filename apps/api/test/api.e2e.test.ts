import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { MailService } from '../src/mail/mail.service.js';
import { VoiceService } from '../src/voice/voice.service.js';
import { setup } from './e2e-setup.js';
import { seed } from '../src/cli/seed.js';
import {
  books,
  levels,
  parents,
  children,
  rounds,
  cashEntries,
  orders,
  quizResults,
  emailOutbox,
  appSettings,
} from '../src/db/schema.js';
import {
  generateRound,
  adminInsightsSchema,
  certificateSchema,
  certificateBookSchema,
  leaderboardSchema,
} from '@udakids/engine';

describe('fondasi API dan akun', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup();
  });
  afterAll(async () => {
    if (ctx) await ctx.close();
  });
  it('migrasi dan seed dapat diulang tanpa menimpa suntingan admin', async () => {
    await ctx.db
      .update(books)
      .set({ title: 'Buku suntingan admin' })
      .where(eq(books.slug, 'matematika-kelas-1'));
    expect(await seed(ctx.db)).toEqual({ books: 5, topics: 50, levels: 199 });
    expect(await ctx.db.select().from(levels)).toHaveLength(199);
    expect(
      (await ctx.db.select().from(books).where(eq(books.slug, 'matematika-kelas-1')))[0]?.title,
    ).toBe('Buku suntingan admin');
  });
  it('health dan header keamanan tersedia', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/health').expect(200);
    expect(res.body.db).toBe(true);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('pendaftaran memerlukan persetujuan dan menolak duplikasi email bersamaan', async () => {
    const data = {
      name: 'Orang Tua',
      email: 'keluarga@example.test',
      password: 'kata-sandi-123',
      consent: true,
    };
    await request(ctx.app.getHttpServer())
      .post('/auth/parent/register')
      .send({ ...data, consent: false })
      .expect(400);
    const responses = await Promise.all(
      [1, 2].map(() => request(ctx.app.getHttpServer()).post('/auth/parent/register').send(data)),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await ctx.db.select().from(parents)).toHaveLength(1);
  });
  it('akun orang tua dan staf memakai jalur masuk terpisah', async () => {
    await request(ctx.app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email: 'keluarga@example.test', password: 'kata-sandi-123' })
      .expect(401);
    const login = await request(ctx.app.getHttpServer())
      .post('/auth/parent/login')
      .send({ email: 'keluarga@example.test', password: 'kata-sandi-123' })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .get('/catalog/home')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(403);
    await request(ctx.app.getHttpServer()).get('/catalog/home').expect(401);
  });
  it('pengisi data demo hanya tersedia untuk admin pada PGlite lokal', async () => {
    const parent = await request(ctx.app.getHttpServer())
      .post('/auth/parent/login')
      .send({ email: 'keluarga@example.test', password: 'kata-sandi-123' });
    await request(ctx.app.getHttpServer())
      .post('/admin/demo-data')
      .set('Authorization', `Bearer ${parent.body.token}`)
      .send({})
      .expect(403);
    const admin = await request(ctx.app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' });
    const driver = process.env.DATABASE_DRIVER;
    process.env.DATABASE_DRIVER = 'postgres';
    try {
      await request(ctx.app.getHttpServer())
        .post('/admin/demo-data')
        .set('Authorization', `Bearer ${admin.body.token}`)
        .send({})
        .expect(403);
    } finally {
      if (driver === undefined) delete process.env.DATABASE_DRIVER;
      else process.env.DATABASE_DRIVER = driver;
    }
  });
  it('batas anak tersimpan di database dan tetap menampilkan profil saat diturunkan', async () => {
    const http = () => request(ctx.app.getHttpServer());
    const adminLogin = await http()
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' })
      .expect(201);
    const admin = `Bearer ${adminLogin.body.token}`;
    const registered = await http()
      .post('/auth/parent/register')
      .send({
        name: 'Keluarga Lima',
        email: 'lima@example.test',
        password: 'kata-sandi-123',
        consent: true,
      })
      .expect(201);
    const parent = `Bearer ${registered.body.token}`;
    expect((await http().get('/settings').expect(200)).body.family.maxChildren).toBe(5);
    expect(
      (await ctx.db.select().from(appSettings).where(eq(appSettings.key, 'family')))[0]?.value,
    ).toEqual({ maxChildren: 5 });

    for (const nickname of ['Ayu', 'Bima', 'Caca', 'Danu', 'Eka'])
      await http()
        .post('/parent/children')
        .set('Authorization', parent)
        .send({ nickname, momoColor: 'blue' })
        .expect(201);
    const sixth = await http()
      .post('/parent/children')
      .set('Authorization', parent)
      .send({ nickname: 'Fani', momoColor: 'pink' })
      .expect(409);
    expect(sixth.body.error.reason).toBe('child_limit');

    await http()
      .put('/admin/settings/family')
      .set('Authorization', admin)
      .send({ maxChildren: 2 })
      .expect(200);
    expect(
      (await ctx.db.select().from(appSettings).where(eq(appSettings.key, 'family')))[0]?.value,
    ).toEqual({ maxChildren: 2 });
    expect(
      (await http().get('/parent/children').set('Authorization', parent).expect(200)).body,
    ).toHaveLength(5);
    await http()
      .post('/parent/children')
      .set('Authorization', parent)
      .send({ nickname: 'Fani', momoColor: 'pink' })
      .expect(409);
    await http()
      .put('/admin/settings/family')
      .set('Authorization', admin)
      .send({ maxChildren: 5 })
      .expect(200);
  });
  it('alur keluarga, ronde dan pembayaran berjalan dengan penilaian di server', async () => {
    const http = () => request(ctx.app.getHttpServer());
    const login = await http()
      .post('/auth/parent/login')
      .send({ email: 'keluarga@example.test', password: 'kata-sandi-123' })
      .expect(201);
    const parent = `Bearer ${login.body.token}`;
    const other = await http()
      .post('/auth/parent/register')
      .send({
        name: 'Keluarga lain',
        email: 'lain@example.test',
        password: 'kata-sandi-123',
        consent: true,
      })
      .expect(201);
    const stranger = `Bearer ${other.body.token}`;
    const created = await http()
      .post('/parent/children')
      .set('Authorization', parent)
      .send({ nickname: 'Ayu', momoColor: 'blue', pin: ['apple', 'star', 'fish'] })
      .expect(201);
    const childId: string = created.body.id;
    await http()
      .patch(`/parent/children/${childId}`)
      .set('Authorization', stranger)
      .send({ nickname: 'Diubah' })
      .expect(404);
    await http()
      .get(`/parent/children/${childId}/report`)
      .set('Authorization', stranger)
      .expect(404);
    await http()
      .patch(`/parent/children/${childId}`)
      .set('Authorization', parent)
      .send({ certificateName: 'Ayu Lestari' })
      .expect(400);
    await http()
      .patch(`/parent/children/${childId}`)
      .set('Authorization', parent)
      .send({ certificateName: 'Ayu Lestari', certificateConsent: true })
      .expect(200);
    const childLogin = await http()
      .post('/auth/child/login')
      .send({ childId, pin: ['apple', 'star', 'fish'] })
      .expect(201);
    const child = `Bearer ${childLogin.body.token}`;
    const level = (await ctx.db.select().from(levels).where(eq(levels.number, 1)))[0]!;
    await http()
      .post('/practice/rounds')
      .set('Authorization', child)
      .send({ levelId: `${level.topicId}:2` })
      .expect(403);
    const opened = await http()
      .post('/practice/rounds')
      .set('Authorization', child)
      .send({ levelId: level.id })
      .expect(201);
    expect(opened.body.questions).toHaveLength(10);
    expect(JSON.stringify(opened.body)).not.toContain('"answer"');
    expect(JSON.stringify(opened.body)).not.toContain('explanation');
    await http()
      .post(`/practice/rounds/${opened.body.roundId}/finish`)
      .set('Authorization', child)
      .expect(409);
    const [round] = await ctx.db.select().from(rounds).where(eq(rounds.id, opened.body.roundId));
    const questions = generateRound(round!.generatorSnapshot, round!.seed);
    for (let index = 0; index < 10; index++)
      await http()
        .post(`/practice/rounds/${round!.id}/answers`)
        .set('Authorization', child)
        .send({
          questionIndex: index,
          answer: index < 8 ? questions[index]!.answer : 'belum-tepat',
        })
        .expect(201);
    await http()
      .post(`/practice/rounds/${round!.id}/answers`)
      .set('Authorization', child)
      .send({ questionIndex: 0, answer: questions[0]!.answer })
      .expect(409);
    const finished = await http()
      .post(`/practice/rounds/${round!.id}/finish`)
      .set('Authorization', child)
      .expect(201);
    expect(finished.body).toMatchObject({ score: 80, correct: 8, wrong: 2, passed: true });
    const repeat = await http()
      .post(`/practice/rounds/${round!.id}/finish`)
      .set('Authorization', child)
      .expect(201);
    expect(repeat.body).toEqual(finished.body);
    const board = await http().get('/leaderboard').set('Authorization', child).expect(200);
    expect(leaderboardSchema.safeParse(board.body).success).toBe(true);
    expect(JSON.stringify(board.body)).not.toContain(childId);
    const overview = await http().get('/parent/overview').set('Authorization', parent).expect(200);
    expect(overview.body.children[0].insights.totals.played).toBe(1);
    const billing = await http().get('/parent/billing').set('Authorization', parent).expect(200);
    const order = await http()
      .post('/parent/orders')
      .set('Authorization', parent)
      .send({
        packageId: billing.body.packages[0].id,
        methodId: billing.body.methods[0].id,
        price: 1,
      })
      .expect(201);
    expect(order.body.total).toBeGreaterThan(1);
    await http().get(`/parent/orders/${order.body.id}`).set('Authorization', stranger).expect(404);
    await http()
      .put(`/parent/orders/${order.body.id}/proof`)
      .set('Authorization', parent)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('gambar-palsu'))
      .expect(400);
    await http()
      .put(`/parent/orders/${order.body.id}/proof`)
      .set('Authorization', parent)
      .set('Content-Type', 'image/png')
      .send(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]))
      .expect(200);
    await http()
      .get(`/parent/orders/${order.body.id}/proof`)
      .set('Authorization', stranger)
      .expect(404);
    const admin = await http()
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' })
      .expect(201);
    await http()
      .post(`/admin/orders/${order.body.id}/approve`)
      .set('Authorization', parent)
      .expect(403);
    await http()
      .post(`/admin/orders/${order.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.body.token}`)
      .expect(201);
    await http()
      .post(`/admin/orders/${order.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.body.token}`)
      .expect(201);
    expect(
      await ctx.db.select().from(cashEntries).where(eq(cashEntries.orderId, order.body.id)),
    ).toHaveLength(1);
    expect(
      (await ctx.db.select().from(orders).where(eq(orders.id, order.body.id)))[0]?.status,
    ).toBe('paid');
    await http().delete(`/parent/children/${childId}`).set('Authorization', stranger).expect(404);
    await http().delete(`/parent/children/${childId}`).set('Authorization', parent).expect(204);
    expect(
      await ctx.db.select().from(quizResults).where(eq(quizResults.childId, childId)),
    ).toHaveLength(0);
    await http().get('/child/profile').set('Authorization', child).expect(401);
  });
  it('lima sandi gambar keliru mengunci profil termasuk saat sandi benar dikirim', async () => {
    const login = await request(ctx.app.getHttpServer())
      .post('/auth/parent/login')
      .send({ email: 'keluarga@example.test', password: 'kata-sandi-123' });
    const res = await request(ctx.app.getHttpServer())
      .post('/parent/children')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ nickname: 'Bima', momoColor: 'green', pin: ['apple', 'star', 'fish'] })
      .expect(201);
    for (let i = 0; i < 4; i++)
      await request(ctx.app.getHttpServer())
        .post('/auth/child/login')
        .send({ childId: res.body.id, pin: ['cat', 'cat', 'cat'] })
        .expect(401);
    const locked = await request(ctx.app.getHttpServer())
      .post('/auth/child/login')
      .send({ childId: res.body.id, pin: ['cat', 'cat', 'cat'] })
      .expect(423);
    expect(locked.body.error.lockedUntil).toBeTruthy();
    await request(ctx.app.getHttpServer())
      .post('/auth/child/login')
      .send({ childId: res.body.id, pin: ['apple', 'star', 'fish'] })
      .expect(423);
    expect(
      (await ctx.db.select().from(children).where(eq(children.id, res.body.id)))[0]?.pinLockCount,
    ).toBe(1);
  });
  it('seluruh halaman admin utama memiliki data HTTP dan menolak orang tua', async () => {
    const admin = await request(ctx.app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' });
    const parent = await request(ctx.app.getHttpServer())
      .post('/auth/parent/login')
      .send({ email: 'keluarga@example.test', password: 'kata-sandi-123' });
    for (const path of [
      '/admin/catalogs',
      '/admin/catalog',
      '/admin/directory/families',
      '/admin/directory/children',
      '/admin/directory/summary',
      '/admin/staff',
      '/admin/dashboard',
      '/admin/insights',
      '/admin/overview',
      '/admin/reports/levels',
      '/admin/children',
      '/admin/notifications',
      '/admin/settings',
      '/admin/orders',
      '/admin/orders/pending-count',
      '/admin/packages',
      '/admin/payment-methods',
      '/admin/certificates',
      '/admin/media/usage',
      '/admin/illustrations',
      '/admin/media',
    ]) {
      await request(ctx.app.getHttpServer()).get(path).expect(401);
      await request(ctx.app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${parent.body.token}`)
        .expect(403);
      const response = await request(ctx.app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${admin.body.token}`);
      expect(response.status, `${path}: ${JSON.stringify(response.body)}`).toBe(200);
      if (path === '/admin/insights')
        expect(adminInsightsSchema.safeParse(response.body).success).toBe(true);
      if (path === '/admin/notifications') expect(response.body.items).toEqual(expect.any(Array));
    }
    const stamp = await request(ctx.app.getHttpServer())
      .post('/admin/stamps')
      .set('Authorization', `Bearer ${admin.body.token}`)
      .send({
        name: 'Stempel uji',
        image:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5sAAAAASUVORK5CYII=',
      })
      .expect(201);
    const history = await request(ctx.app.getHttpServer())
      .delete(`/admin/stamps/${stamp.body.id}`)
      .set('Authorization', `Bearer ${admin.body.token}`)
      .expect(200);
    expect(history.body).toEqual([]);
    await request(ctx.app.getHttpServer())
      .patch(`/admin/staff/${admin.body.user.id}`)
      .set('Authorization', `Bearer ${admin.body.token}`)
      .send({ active: false })
      .expect(409);
  });
  it('bank soal tersimpan, dimainkan, dan tidak mengubah ronde yang sudah dibuka', async () => {
    const admin = await request(ctx.app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' });
    const parent = await request(ctx.app.getHttpServer())
      .post('/auth/parent/login')
      .send({ email: 'lain@example.test', password: 'kata-sandi-123' });
    const created = await request(ctx.app.getHttpServer())
      .post('/parent/children')
      .set('Authorization', `Bearer ${parent.body.token}`)
      .send({ nickname: 'Citra', momoColor: 'pink', pin: ['apple', 'star', 'fish'] })
      .expect(201);
    const child = await request(ctx.app.getHttpServer())
      .post('/auth/child/login')
      .send({ childId: created.body.id, pin: ['apple', 'star', 'fish'] })
      .expect(201);
    const token = `Bearer ${admin.body.token}`;
    const added = await request(ctx.app.getHttpServer())
      .post('/admin/books')
      .set('Authorization', token)
      .send({
        subject: 'Seni',
        grade: 1,
        title: 'Seni Kelas 1',
        topic: {
          title: 'Mengenal warna',
          lesson: 'Mari mengenal warna.',
          tips: [],
          levels: [{ title: 'Warna dasar' }],
        },
      })
      .expect(201);
    const book = added.body.find((b: { slug: string }) => b.slug === 'seni-kelas-1');
    const id: string = book.topics[0].levels[0].id;
    await request(ctx.app.getHttpServer())
      .post('/practice/rounds')
      .set('Authorization', `Bearer ${child.body.token}`)
      .send({ levelId: id })
      .expect(409);
    const items = Array.from({ length: 4 }, (_, i) => ({
      prompt: `Pilih angka ${i + 1}.`,
      choices: [String(i + 1), String(i + 10)],
      answer: 0,
      hint: 'Lihat angkanya lagi.',
    }));
    await request(ctx.app.getHttpServer())
      .put(`/admin/levels/${id}/questions`)
      .set('Authorization', token)
      .send({ items })
      .expect(200);
    const round = await request(ctx.app.getHttpServer())
      .post('/practice/rounds')
      .set('Authorization', `Bearer ${child.body.token}`)
      .send({ levelId: id })
      .expect(201);
    const [row] = await ctx.db.select().from(rounds).where(eq(rounds.id, round.body.roundId));
    const qs = generateRound(row!.generatorSnapshot, row!.seed);
    await request(ctx.app.getHttpServer())
      .put(`/admin/levels/${id}/questions`)
      .set('Authorization', token)
      .send({ items: items.map((q) => ({ ...q, answer: 1 })) })
      .expect(200);
    for (let i = 0; i < 10; i++)
      await request(ctx.app.getHttpServer())
        .post(`/practice/rounds/${row!.id}/answers`)
        .set('Authorization', `Bearer ${child.body.token}`)
        .send({ questionIndex: i, answer: qs[i]!.answer })
        .expect(201);
    const result = await request(ctx.app.getHttpServer())
      .post(`/practice/rounds/${row!.id}/finish`)
      .set('Authorization', `Bearer ${child.body.token}`)
      .expect(201);
    expect(result.body.score).toBe(100);
    await request(ctx.app.getHttpServer())
      .delete('/admin/books/seni-kelas-1')
      .set('Authorization', token)
      .expect(409);
    const certificates = await request(ctx.app.getHttpServer())
      .get('/admin/certificates')
      .set('Authorization', token)
      .expect(200);
    expect(
      certificates.body.candidates.some((c: { childId: string }) => c.childId === created.body.id),
    ).toBe(true);
    await request(ctx.app.getHttpServer())
      .post('/certificates/books/seni-kelas-1/claim')
      .set('Authorization', `Bearer ${child.body.token}`)
      .expect(403);
    const issued = await request(ctx.app.getHttpServer())
      .post('/admin/certificates')
      .set('Authorization', token)
      .send({ childId: created.body.id, bookSlug: 'seni-kelas-1' })
      .expect(201);
    expect(certificateSchema.safeParse(issued.body).success).toBe(true);
    const claimed = await request(ctx.app.getHttpServer())
      .post('/certificates/books/seni-kelas-1/claim')
      .set('Authorization', `Bearer ${child.body.token}`)
      .expect(201);
    expect(certificateBookSchema.safeParse(claimed.body).success).toBe(true);
    const verify = await request(ctx.app.getHttpServer())
      .get(`/certificates/verify/${issued.body.id}`)
      .expect(200);
    expect(verify.body.name).toBe('C****');
    await request(ctx.app.getHttpServer())
      .get(`/admin/children/${created.body.id}/report`)
      .set('Authorization', token)
      .expect(200);
  });
  it('gambar harus ditinjau, biner dibatasi, dan cache suara tidak membuat klip ganda', async () => {
    const admin = await request(ctx.app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email: 'admin@udakids.local', password: 'tes-admin-aman-123' });
    const token = `Bearer ${admin.body.token}`;
    const res = await request(ctx.app.getHttpServer())
      .post('/admin/illustrations')
      .set('Authorization', token)
      .send({
        kind: 'object',
        subject: 'apel merah',
        theme: 'plain',
        count: 3,
        withMomo: false,
        momoColor: 'blue',
        variant: 1,
      })
      .expect(201);
    expect(res.body.status).toBe('review');
    await request(ctx.app.getHttpServer()).get(`/illustrations/${res.body.id}/image`).expect(404);
    await request(ctx.app.getHttpServer())
      .get(`/admin/illustrations/${res.body.id}/image`)
      .set('Authorization', token)
      .expect(200);
    await request(ctx.app.getHttpServer())
      .patch(`/admin/illustrations/${res.body.id}`)
      .set('Authorization', token)
      .send({ status: 'approved' })
      .expect(200);
    await request(ctx.app.getHttpServer()).get(`/illustrations/${res.body.id}/image`).expect(200);
    await request(ctx.app.getHttpServer())
      .post('/admin/media')
      .set('Authorization', token)
      .set('Content-Type', 'image/svg+xml')
      .send('<svg/>')
      .expect(400);
    await request(ctx.app.getHttpServer())
      .post('/auth/parent/login')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('x'))
      .expect(415);
    await request(ctx.app.getHttpServer())
      .post('/admin/media')
      .set('Authorization', token)
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(3 * 1024 * 1024 + 1))
      .expect(413);
    const voice = ctx.app.get(VoiceService);
    await voice.drain();
    const before = ctx.speech.length;
    await voice.urls(['Tes suara unik.']);
    await voice.drain();
    const urls = await voice.urls(['Tes suara unik.']);
    await voice.drain();
    expect(ctx.speech.length - before).toBe(1);
    expect(urls[0]).toBeTruthy();
    await request(ctx.app.getHttpServer())
      .get(urls[0]!.replace('/api', ''))
      .expect(200)
      .expect('Cache-Control', 'public, max-age=31536000, immutable');
  });
  it('email dikirim melalui outbox dan isinya dihapus setelah terkirim', async () => {
    await ctx.app.get(MailService).flush();
    expect(ctx.mails.length).toBeGreaterThan(0);
    const sent = await ctx.db.select().from(emailOutbox).where(eq(emailOutbox.status, 'sent'));
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((r) => r.html === null && r.text === null)).toBe(true);
  });
});
