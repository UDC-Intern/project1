import { useRef, useState, type FormEvent } from 'react';
import { formatRupiah, type AffiliateSettings, type PayoutProvider } from '@udakids/engine';
import { errorMessage } from '../api/client';
import { useApiCall, useFetch } from '../auth/useApi';
import { Button, Card, Notice, PageHeader, Spinner, TextField } from '../ui/ui';
import './affiliate.css';

type Account = {
  providerId: string;
  providerName: string;
  kind: string;
  last4: string;
  holderName: string;
  status: string;
  reviewNote: string | null;
  changedAt: string;
};
type Entry = {
  id: string;
  type: string;
  state: string;
  amount: number;
  note: string | null;
  createdAt: string;
  availableAt: string | null;
};
type Payout = {
  id: string;
  amount: number;
  providerName: string;
  last4: string;
  status: string;
  note: string | null;
  requestedAt: string;
  transferRef: string | null;
};
type Overview = {
  enabled: boolean;
  code: string;
  link: string;
  rules: AffiliateSettings;
  providers: PayoutProvider[];
  balance: { available: number; pending: number; earned: number; paid: number };
  counts: {
    clicks: number;
    signups: number;
    verified: number;
    active: number;
    subscribers: number;
  };
  account: Account | null;
  openPayout: Payout | null;
  recent: Entry[];
};
type Member = {
  name: string;
  joinedAt: string;
  verified: boolean;
  active: boolean;
  paidOrders: number;
  rounds: number;
  earned: number;
};
const money = (value: number) => formatRupiah(value);
const date = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export function AffiliatePage() {
  const overview = useFetch<Overview>('parent', '/parent/affiliate');
  const [tab, setTab] = useState<'members' | 'analytics' | 'ledger' | 'payout'>('members');
  const [copied, setCopied] = useState(false);
  const data = overview.data;
  if (overview.loading && !data) return <Spinner label="Memuat afiliasi" />;
  if (!data)
    return (
      <Notice tone="error">
        {errorMessage(overview.error)} <Button onClick={overview.reload}>Coba lagi</Button>
      </Notice>
    );
  return (
    <div className="aff-page">
      <PageHeader
        title="Afiliasi"
        subtitle="Ajak orang tua lain belajar bersama Momo dan pantau hasil ajakanmu."
      />
      {!data.enabled && (
        <Notice tone="warning">
          Program afiliasi sedang tidak aktif. Riwayat dan saldomu tetap tersimpan.
        </Notice>
      )}
      <Card className="aff-share">
        <div>
          <h2>Bagikan tautan ajakan</h2>
          <p>
            Kode afiliasi: <strong>{data.code}</strong>
          </p>
          <p>Teman yang mendaftar lewat tautan ini otomatis tercatat sebagai anggota langsungmu.</p>
        </div>
        <div className="aff-share-actions">
          <input aria-label="Tautan ajakan" readOnly value={data.link} />
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(data.link).then(() => setCopied(true));
            }}
          >
            {copied ? 'Tersalin' : 'Salin tautan'}
          </Button>
          <a
            className="ui-btn ui-btn-secondary"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`Ayo belajar bersama di UdaKids! ${data.link}`)}`}
          >
            Bagikan ke WhatsApp
          </a>
        </div>
      </Card>
      <div className="aff-stats">
        <Card>
          <small>Saldo tersedia</small>
          <strong>{money(data.balance.available)}</strong>
        </Card>
        <Card>
          <small>Saldo tertahan</small>
          <strong>{money(data.balance.pending)}</strong>
        </Card>
        <Card>
          <small>Total diperoleh</small>
          <strong>{money(data.balance.earned)}</strong>
        </Card>
        <Card>
          <small>Sudah dicairkan</small>
          <strong>{money(data.balance.paid)}</strong>
        </Card>
      </div>
      <div className="aff-grid">
        <Card>
          <h2>Perjalanan ajakan</h2>
          <div className="aff-funnel">
            {(
              [
                ['Tautan dibuka', data.counts.clicks],
                ['Daftar', data.counts.signups],
                ['Email terverifikasi', data.counts.verified],
                ['Aktif belajar', data.counts.active],
                ['Berlangganan', data.counts.subscribers],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2>Cara mendapatkan komisi</h2>
          <p>
            Bonus {money(data.rules.signupBonus)} diberikan setelah teman yang diajak memverifikasi
            email dan anaknya menyelesaikan {data.rules.qualifyRounds} ronde dalam{' '}
            {data.rules.qualifyDays} hari.
          </p>
          <p>
            Setiap pembelian paket teman langsung memberi komisi{' '}
            {(data.rules.commissionBp / 100).toLocaleString('id-ID')}%. Komisi dapat dicairkan
            setelah {data.rules.holdDays} hari. Tidak ada komisi dari anggota tingkat kedua.
          </p>
          <p>
            Minimal pencairan {money(data.rules.minPayout)}. Rekening baru dapat dipakai setelah{' '}
            {data.rules.accountCooldownDays} hari.
          </p>
        </Card>
      </div>
      <nav className="aff-tabs" aria-label="Rincian afiliasi">
        {(
          [
            ['members', 'Anggota'],
            ['analytics', 'Analisis'],
            ['ledger', 'Riwayat saldo'],
            ['payout', 'Pencairan'],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={tab === id ? 'is-active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'members' && <Members />}
      {tab === 'analytics' && <Analytics />}
      {tab === 'ledger' && <Ledger />}
      {tab === 'payout' && <PayoutPanel data={data} reload={overview.reload} />}
    </div>
  );
}

function Members() {
  const { data, loading, error, reload } = useFetch<{ total: number; items: Member[] }>(
    'parent',
    '/parent/affiliate/members',
  );
  if (loading && !data) return <Spinner label="Memuat anggota" />;
  if (!data)
    return (
      <Notice tone="error">
        {errorMessage(error)} <Button onClick={reload}>Coba lagi</Button>
      </Notice>
    );
  return (
    <Card>
      <h2>Anggota langsung ({data.total})</h2>
      {!data.items.length ? (
        <p>Belum ada yang mendaftar lewat tautanmu.</p>
      ) : (
        <div className="aff-table-wrap">
          <table className="aff-table">
            <thead>
              <tr>
                <th>Orang tua</th>
                <th>Bergabung</th>
                <th>Status</th>
                <th>Ronde anak</th>
                <th>Pembelian</th>
                <th>Komisi</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m, i) => (
                <tr key={i}>
                  <td>{m.name}</td>
                  <td>{date(m.joinedAt)}</td>
                  <td>
                    {m.paidOrders
                      ? 'Berlangganan'
                      : m.active
                        ? 'Aktif belajar'
                        : m.verified
                          ? 'Sudah verifikasi'
                          : 'Menunggu verifikasi'}
                  </td>
                  <td>{m.rounds}</td>
                  <td>{m.paidOrders}</td>
                  <td>{money(m.earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="ui-muted">Nama anggota disamarkan dan data anak tidak ditampilkan.</p>
    </Card>
  );
}

function Analytics() {
  const { data, loading, error } = useFetch<{
    clicks: { day: string; clicks: number }[];
    earnings: { amount: number; type: string; createdAt: string }[];
  }>('parent', '/parent/affiliate/analytics');
  if (loading && !data) return <Spinner label="Memuat analisis" />;
  if (!data) return <Notice tone="error">{errorMessage(error)}</Notice>;
  const days = data.clicks.slice(-14);
  const max = Math.max(1, ...days.map((d) => d.clicks));
  return (
    <Card>
      <h2>Kunjungan tautan (14 hari terakhir yang memiliki klik)</h2>
      {!days.length ? (
        <p>Belum ada kunjungan.</p>
      ) : (
        <div className="aff-bars">
          {days.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.clicks} klik`}>
              <span style={{ height: `${Math.max(3, (d.clicks / max) * 100)}%` }} />
              <small>{d.day.slice(5)}</small>
            </div>
          ))}
        </div>
      )}
      <p>
        Bonus ajakan:{' '}
        {money(
          data.earnings.filter((e) => e.type === 'signup_bonus').reduce((n, e) => n + e.amount, 0),
        )}{' '}
        · Komisi paket:{' '}
        {money(
          data.earnings.filter((e) => e.type === 'commission').reduce((n, e) => n + e.amount, 0),
        )}
      </p>
    </Card>
  );
}

function Ledger() {
  const { data, loading, error } = useFetch<{ items: Entry[] }>(
    'parent',
    '/parent/affiliate/ledger',
  );
  if (loading && !data) return <Spinner label="Memuat riwayat" />;
  if (!data) return <Notice tone="error">{errorMessage(error)}</Notice>;
  return (
    <Card>
      <h2>Riwayat saldo</h2>
      {!data.items.length ? (
        <p>Belum ada pergerakan saldo.</p>
      ) : (
        <div className="aff-table-wrap">
          <table className="aff-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Status</th>
                <th>Jumlah</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td>{date(e.createdAt)}</td>
                  <td>
                    {{
                      signup_bonus: 'Bonus ajakan',
                      commission: 'Komisi paket',
                      payout: 'Pencairan',
                      payout_return: 'Saldo kembali',
                      adjustment: 'Penyesuaian',
                    }[e.type] ?? e.type}
                  </td>
                  <td>
                    {{ pending: 'Tertahan', available: 'Tersedia', void: 'Gugur' }[e.state] ??
                      e.state}
                  </td>
                  <td>{money(e.amount)}</td>
                  <td>{e.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PayoutPanel({ data, reload }: { data: Overview; reload: () => void }) {
  const call = useApiCall('parent');
  const list = useFetch<Payout[]>('parent', '/parent/affiliate/payouts');
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [providerId, setProviderId] = useState(
    data.account?.providerId ?? data.providers[0]?.id ?? '',
  );
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState(data.account?.holderName ?? '');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState(data.balance.available || data.rules.minPayout);
  async function run(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await action();
      reload();
      list.reload();
      setMessage('Perubahan berhasil disimpan.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }
  function saveAccount(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      call('/parent/affiliate/account', {
        method: 'PUT',
        body: { providerId, accountNumber, holderName, code },
      }),
    );
  }
  function request(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      call('/parent/affiliate/payouts', { method: 'POST', body: { amount: Number(amount) } }),
    );
  }
  return (
    <div className="aff-grid">
      <Card>
        <h2>Rekening pencairan</h2>
        {data.account && (
          <p>
            {data.account.providerName} •••• {data.account.last4} atas nama{' '}
            {data.account.holderName}
            <br />
            Status:{' '}
            <strong>
              {data.account.status === 'verified'
                ? 'Terverifikasi'
                : data.account.status === 'pending'
                  ? 'Menunggu admin'
                  : 'Ditolak'}
            </strong>{' '}
            {data.account.reviewNote && `· ${data.account.reviewNote}`}
          </p>
        )}
        <form className="aff-form" onSubmit={saveAccount}>
          <label>
            Bank atau e-wallet
            <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
              {data.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Nomor rekening / e-wallet"
            inputMode="numeric"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            required
          />
          <TextField
            label="Nama pemilik rekening"
            value={holderName}
            onChange={(event) => setHolderName(event.target.value)}
            required
          />
          <div className="aff-code">
            <TextField
              label="Kode verifikasi email"
              inputMode="numeric"
              value={code}
              maxLength={6}
              onChange={(event) => setCode(event.target.value)}
              required
            />
            <Button
              disabled={working}
              onClick={() =>
                void run(() => call('/parent/affiliate/account/code', { method: 'POST' }))
              }
            >
              Kirim kode
            </Button>
          </div>
          <Button type="submit" disabled={working || !accountNumber || code.length !== 6}>
            Simpan rekening
          </Button>
        </form>
      </Card>
      <Card>
        <h2>Ajukan pencairan</h2>
        <p>
          Saldo tersedia: <strong>{money(data.balance.available)}</strong>
        </p>
        <p>
          Minimal {money(data.rules.minPayout)}; rekening harus terverifikasi dan melewati masa
          jeda.
        </p>
        <form className="aff-form" onSubmit={request}>
          <TextField
            label="Jumlah (Rp)"
            type="number"
            min={data.rules.minPayout}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            required
          />
          <Button type="submit" disabled={working || !!data.openPayout || !data.enabled}>
            Ajukan pencairan
          </Button>
        </form>
        {data.openPayout && <Notice tone="info">Ada pencairan yang sedang diproses.</Notice>}
        <h3>Riwayat pencairan</h3>
        {!list.data?.length ? (
          <p>Belum ada pencairan.</p>
        ) : (
          list.data.map((p) => (
            <div className="aff-payout" key={p.id}>
              <span>
                {date(p.requestedAt)} · {p.providerName} •••• {p.last4}
                <br />
                {money(p.amount)} · {p.status}
              </span>
              {p.status === 'requested' && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={working}
                  onClick={() =>
                    void run(() =>
                      call(`/parent/affiliate/payouts/${p.id}/cancel`, { method: 'POST' }),
                    )
                  }
                >
                  Batalkan
                </Button>
              )}
            </div>
          ))
        )}
      </Card>
      {(error || message) && <Notice tone={error ? 'error' : 'success'}>{error || message}</Notice>}
    </div>
  );
}
