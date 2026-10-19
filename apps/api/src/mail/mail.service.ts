import {
  Inject,
  Injectable,
  Optional,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { DB, type Db, type Executor } from '../db/db.module.js';
import { emailOutbox } from '../db/schema.js';
import type { Mail } from './templates.js';
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
export type MailTransport = {
  sendMail(mail: {
    from?: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
  close?: () => void;
};
const BACKOFF = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running: Promise<number> = Promise.resolve(0);
  private transport: MailTransport | null;
  constructor(
    @Inject(DB) private db: Db,
    @Optional() @Inject(MAIL_TRANSPORT) transport?: MailTransport,
  ) {
    const user = process.env.SMTP_USER;
    const pass = (process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD)?.replace(/\s/g, '');
    const port = Number(process.env.SMTP_PORT ?? 465);
    this.transport =
      transport ??
      (user && pass
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
            port,
            secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
            auth: { user, pass },
            pool: true,
            maxConnections: 1,
            requireTLS: port !== 465,
            tls: { minVersion: 'TLSv1.2' },
            connectionTimeout: 30_000,
            socketTimeout: 30_000,
          })
        : null);
  }
  onModuleInit() {
    if (process.env.MAIL_WORKER === 'off') return;
    this.timer = setInterval(
      () => {
        void this.flush().catch(() => console.error('Antrean email belum bisa diproses.'));
      },
      Number(process.env.MAIL_TICK_MS ?? 15_000),
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.transport?.close?.();
  }
  async enqueue(to: string, mail: Mail, kind: string, refId?: string, tx: Executor = this.db) {
    await tx.insert(emailOutbox).values({ toEmail: to.trim().toLowerCase(), ...mail, kind, refId });
  }
  async notify(to: string, mail: Mail, kind: string, refId: string, tx: Executor) {
    const recipients = new Set([
      to,
      ...(process.env.MAIL_DIRECTOR ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ]);
    for (const recipient of recipients) await this.enqueue(recipient, mail, kind, refId, tx);
  }
  flush() {
    this.running = this.running.catch(() => 0).then(() => this.flushOnce());
    return this.running;
  }
  private async flushOnce() {
    const rows = await this.db
      .select()
      .from(emailOutbox)
      .where(
        and(
          inArray(emailOutbox.status, ['queued', 'retry', 'waiting_smtp']),
          lte(emailOutbox.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(emailOutbox.createdAt)
      .limit(20);
    for (const row of rows) {
      if (!this.transport) {
        await this.db
          .update(emailOutbox)
          .set({ status: 'waiting_smtp', nextAttemptAt: new Date(Date.now() + 300_000) })
          .where(eq(emailOutbox.id, row.id));
        continue;
      }
      try {
        await this.transport.sendMail({
          from: process.env.MAIL_FROM?.trim() || process.env.SMTP_USER,
          to: row.toEmail,
          subject: row.subject,
          html: row.html ?? '',
          text: row.text ?? '',
        });
        await this.db
          .update(emailOutbox)
          .set({
            status: 'sent',
            sentAt: new Date(),
            html: null,
            text: null,
            subject: row.subject.replace(/\b\d{6}\b/g, '••••••'),
            lastError: null,
          })
          .where(eq(emailOutbox.id, row.id));
      } catch {
        const attempts = row.attempts + 1;
        await this.db
          .update(emailOutbox)
          .set({
            attempts,
            status: attempts > BACKOFF.length ? 'failed' : 'retry',
            lastError: 'Pengiriman belum berhasil.',
            nextAttemptAt: new Date(Date.now() + (BACKOFF[attempts - 1] ?? 0)),
          })
          .where(eq(emailOutbox.id, row.id));
      }
    }
    return rows.length;
  }
  async overview() {
    const counts = await this.db
      .select({ status: emailOutbox.status, count: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .groupBy(emailOutbox.status);
    const rows = await this.db
      .select({
        id: emailOutbox.id,
        to: emailOutbox.toEmail,
        subject: emailOutbox.subject,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        createdAt: emailOutbox.createdAt,
      })
      .from(emailOutbox)
      .orderBy(sql`${emailOutbox.createdAt} desc`)
      .limit(50);
    return {
      configured: !!this.transport,
      counts,
      items: rows.map((r) => ({
        ...r,
        to: r.to.replace(/^(.).*@/, '$1•••@'),
        subject: r.subject.replace(/\b\d{6}\b/g, '••••••'),
      })),
    };
  }
}
