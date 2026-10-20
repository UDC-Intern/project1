import { useRef, useState, type FormEvent } from 'react';
import { formatRupiah, type AffiliateSettings } from '@udakids/engine';
import { errorMessage } from '../../api/client';
import { useApiCall, useFetch } from '../../auth/useApi';
import {
  Button,
  Card,
  Dialog,
  Notice,
  PageHeader,
  Spinner,
  TextArea,
  TextField,
} from '../../ui/ui';
import '../../parent/affiliate.css';

type Overview = {
  affiliates: number;
  pendingPayouts: number;
  pendingAccounts: number;
  earned: number;
};
type Analytics = {
  months: { month: string; bonus: number; commission: number }[];
  funnel: {
    clicks: number;
    signups: number;
    verified: number;
    active: number;
    subscribers: number;
  };
  referredRevenue: number;
};
type Affiliate = {
  id: string;
  name: string;
  email: string;
  code: string;
  members: number;
  balance: { available: number; pending: number; earned: number; paid: number };
};
type AffiliateDetail = Omit<Affiliate, 'members'> & {
  secondLevel: number;
  members: { total: number; items: { name: string; active: boolean; paidOrders: number }[] };
  ledger: {
    id: string;
    type: string;
    state: string;
    amount: number;
    note: string | null;
    createdAt: string;
  }[];
};
type Payout = {
  request: {
    id: string;
    parentId: string;
    amount: number;
    providerName: string;
    accountNumber: string;
    holderName: string;
    status: string;
    requestedAt: string;
    note: string | null;
  };
  name: string;
};
type Account = {
  account: {
    parentId: string;
    providerName: string;
    accountNumber: string;
    holderName: string;
    status: string;
    reviewNote: string | null;
  };
  name: string;
};
const money = (n: number) => formatRupiah(n);
const date = (d: string) => new Date(d).toLocaleDateString('id-ID');

export function AffiliateAdminPage() {
  const overview = useFetch<Overview>('staff', '/admin/affiliate');
  const [tab, setTab] = useState<
    'overview' | 'analytics' | 'affiliates' | 'payouts' | 'accounts' | 'settings'
  >('overview');
  return (
    <div className="aff-page">
      <PageHeader
        title="Afiliasi"
        subtitle="Pantau ajakan, verifikasi rekening, dan proses pencairan komisi."
      />
      <nav className="afp-tabs" aria-label="Pengelolaan afiliasi">
        {(
          [
            ['overview', 'Ringkasan'],
            ['analytics', 'Analisis'],
            ['affiliates', 'Afiliator'],
            ['payouts', 'Pencairan'],
            ['accounts', 'Rekening'],
            ['settings', 'Pengaturan'],
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
      {tab === 'overview' &&
        (overview.loading && !overview.data ? (
          <Spinner label="Memuat ringkasan" />
        ) : overview.data ? (
          <div className="aff-stats">
            <Card>
              <small>Pengguna afiliasi</small>
              <strong>{overview.data.affiliates}</strong>
            </Card>
            <Card>
              <small>Pencairan menunggu</small>
              <strong>{overview.data.pendingPayouts}</strong>
            </Card>
            <Card>
              <small>Rekening perlu verifikasi</small>
              <strong>{overview.data.pendingAccounts}</strong>
            </Card>
            <Card>
              <small>Bonus dan komisi tercatat</small>
              <strong>{money(overview.data.earned)}</strong>
            </Card>
          </div>
        ) : (
          <Notice tone="error">{errorMessage(overview.error)}</Notice>
        ))}
      {tab === 'affiliates' && <Affiliates />}
      {tab === 'analytics' && <AffiliateAnalytics />}
      {tab === 'payouts' && <Payouts onChange={overview.reload} />}
      {tab === 'accounts' && <Accounts onChange={overview.reload} />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

function AffiliateAnalytics() {
  const { data, loading, error } = useFetch<Analytics>('staff', '/admin/affiliate/analytics');
  if (loading && !data) return <Spinner label="Memuat analisis" />;
  if (!data) return <Notice tone="error">{errorMessage(error)}</Notice>;
  const stages = [
    ['Klik tautan', data.funnel.clicks],
    ['Pendaftar', data.funnel.signups],
    ['Email terverifikasi', data.funnel.verified],
    ['Aktif belajar', data.funnel.active],
    ['Berlangganan', data.funnel.subscribers],
  ] as const;
  return (
    <div className="afp-grid">
      <Card>
        <h2>Perjalanan anggota</h2>
        <p>
          Klik dihitung sekali per perangkat per hari. Anggota aktif telah memenuhi syarat bonus.
        </p>
        {stages.map(([label, count]) => (
          <p key={label}>
            <strong>
              {label}: {count}
            </strong>
          </p>
        ))}
      </Card>
      <Card>
        <h2>Pendapatan dari anggota ajakan</h2>
        <strong>{money(data.referredRevenue)}</strong>
        <p>Total pesanan lunas, sebelum dikurangi bonus dan komisi afiliasi.</p>
      </Card>
      <Card>
        <h2>Bonus dan komisi per bulan</h2>
        <div className="aff-table-wrap">
          <table className="aff-table">
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Bonus</th>
                <th>Komisi</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{money(row.bonus)}</td>
                  <td>{money(row.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Affiliates() {
  const { data, loading, error, reload } = useFetch<Affiliate[]>(
    'staff',
    '/admin/affiliate/affiliates',
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  if (loading && !data) return <Spinner label="Memuat afiliator" />;
  if (!data)
    return (
      <Notice tone="error">
        {errorMessage(error)} <Button onClick={reload}>Coba lagi</Button>
      </Notice>
    );
  const rows = data
    .filter(
      (x) => x.code && `${x.name} ${x.email} ${x.code}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.members - a.members || b.balance.earned - a.balance.earned);
  return (
    <Card>
      <h2>Afiliator</h2>
      <TextField
        label="Cari nama, email, atau kode"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!rows.length ? (
        <p>Belum ada afiliator yang cocok.</p>
      ) : (
        <div className="aff-table-wrap">
          <table className="aff-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Kode</th>
                <th>Anggota</th>
                <th>Total diperoleh</th>
                <th>Saldo tersedia</th>
                <th>Rincian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td>{x.email}</td>
                  <td>{x.code}</td>
                  <td>{x.members}</td>
                  <td>{money(x.balance.earned)}</td>
                  <td>{money(x.balance.available)}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(x.id)}>
                      Buka
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <AffiliateDetailCard
          parentId={selected}
          onClose={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function AffiliateDetailCard({ parentId, onClose }: { parentId: string; onClose: () => void }) {
  const detail = useFetch<AffiliateDetail>('staff', `/admin/affiliate/affiliates/${parentId}`);
  const call = useApiCall('staff');
  const busy = useRef(false);
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
      detail.reload();
      setMessage('Perubahan tersimpan.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      busy.current = false;
    }
  }
  return (
    <section className="aff-detail">
      <Button variant="ghost" onClick={onClose}>
        Tutup rincian
      </Button>
      {message && <Notice tone="info">{message}</Notice>}
      {detail.loading && !detail.data ? (
        <Spinner label="Memuat rincian" />
      ) : detail.data ? (
        <>
          <h3>
            {detail.data.name} · {detail.data.code}
          </h3>
          <p>
            {detail.data.members.total} anggota langsung · {detail.data.secondLevel} anggota tingkat
            dua · Saldo {money(detail.data.balance.available)}
          </p>
          <h4>Anggota</h4>
          <p>
            {detail.data.members.items
              .map(
                (m) => `${m.name} (${m.active ? 'aktif' : 'belum aktif'}, ${m.paidOrders} pesanan)`,
              )
              .join(' · ') || 'Belum ada anggota.'}
          </p>
          <h4>Riwayat saldo</h4>
          <div className="aff-table-wrap">
            <table className="aff-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th>Status</th>
                  <th>Jumlah</th>
                  <th>Keterangan</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {detail.data.ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td>{date(entry.createdAt)}</td>
                    <td>{entry.type}</td>
                    <td>{entry.state}</td>
                    <td>{money(entry.amount)}</td>
                    <td>{entry.note}</td>
                    <td>
                      {entry.state === 'pending' &&
                        (entry.type === 'signup_bonus' || entry.type === 'commission') && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              const note = window.prompt('Alasan pembatalan');
                              if (note?.trim())
                                void run(() =>
                                  call(`/admin/affiliate/ledger/${entry.id}/void`, {
                                    method: 'POST',
                                    body: { note },
                                  }),
                                );
                            }}
                          >
                            Batalkan
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              const amount = Number(
                window.prompt('Jumlah koreksi saldo dalam rupiah (negatif untuk mengurangi)'),
              );
              if (!Number.isInteger(amount) || amount === 0) return;
              const note = window.prompt('Alasan koreksi');
              if (note?.trim())
                void run(() =>
                  call(`/admin/affiliate/affiliates/${parentId}/adjust`, {
                    method: 'POST',
                    body: { amount, note },
                  }),
                );
            }}
          >
            Koreksi saldo
          </Button>
        </>
      ) : (
        <Notice tone="error">{errorMessage(detail.error)}</Notice>
      )}
    </section>
  );
}

function Payouts({ onChange }: { onChange: () => void }) {
  const list = useFetch<Payout[]>('staff', '/admin/affiliate/payouts');
  const call = useApiCall('staff');
  const lock = useRef(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [decision, setDecision] = useState<{
    request: Payout['request'];
    name: string;
    action: 'paid' | 'reject';
    reason: string;
  } | null>(null);
  async function run(id: string, action: () => Promise<unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(id);
    setMessage('');
    try {
      await action();
      list.reload();
      onChange();
      setMessage('Perubahan berhasil disimpan.');
      return true;
    } catch (error) {
      setMessage(errorMessage(error));
      setDecisionError(errorMessage(error));
      return false;
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  if (list.loading && !list.data) return <Spinner label="Memuat pencairan" />;
  if (!list.data) return <Notice tone="error">{errorMessage(list.error)}</Notice>;
  return (
    <Card>
      <h2>Pengajuan pencairan</h2>
      {message && <Notice tone="info">{message}</Notice>}
      {!list.data.length ? (
        <p>Belum ada pengajuan.</p>
      ) : (
        <div className="aff-table-wrap">
          <table className="aff-table afp-payout-table">
            <thead>
              <tr>
                <th>Orang tua</th>
                <th>Tanggal</th>
                <th>Jumlah</th>
                <th>Bank / e-wallet</th>
                <th>Nama rekening</th>
                <th>No. rekening</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map(({ request: r, name }) => (
                <tr key={r.id}>
                  <td>{name}</td>
                  <td>{date(r.requestedAt)}</td>
                  <td>{money(r.amount)}</td>
                  <td>{r.providerName}</td>
                  <td>{r.holderName}</td>
                  <td className="afp-account-number">{r.accountNumber}</td>
                  <td>
                    {r.status}
                    {r.note && <small> · {r.note}</small>}
                  </td>
                  <td>
                    {r.status === 'requested' && (
                      <div className="afp-payout-actions">
                        <Button
                          size="sm"
                          disabled={!!busy}
                          onClick={() => {
                            setDecisionError('');
                            setDecision({ request: r, name, action: 'paid', reason: '' });
                          }}
                        >
                          Sudah dibayar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!!busy}
                          onClick={() => {
                            setDecisionError('');
                            setDecision({ request: r, name, action: 'reject', reason: '' });
                          }}
                        >
                          Tolak
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={!!decision}
        title={decision?.action === 'paid' ? 'Konfirmasi pencairan' : 'Tolak pencairan'}
        tone="warning"
        onClose={() => !busy && setDecision(null)}
        actions={
          <>
            <Button variant="ghost" disabled={!!busy} onClick={() => setDecision(null)}>
              Batal
            </Button>
            <Button
              variant={decision?.action === 'reject' ? 'danger' : 'primary'}
              disabled={
                !!busy || (decision?.action === 'reject' && decision.reason.trim().length < 3)
              }
              onClick={() => {
                if (!decision) return;
                const current = decision;
                const action =
                  current.action === 'paid'
                    ? () =>
                        call('/admin/affiliate/payouts/' + current.request.id + '/paid', {
                          method: 'POST',
                          body: {},
                        })
                    : () =>
                        call('/admin/affiliate/payouts/' + current.request.id + '/reject', {
                          method: 'POST',
                          body: { reason: current.reason.trim() },
                        });
                void run(current.request.id, action).then((saved) => {
                  if (saved) setDecision(null);
                });
              }}
            >
              {busy
                ? 'Menyimpan…'
                : decision?.action === 'paid'
                  ? 'Ya, sudah dibayar'
                  : 'Tolak pencairan'}
            </Button>
          </>
        }
      >
        {decision?.action === 'paid' ? (
          <p>
            Tandai {money(decision.request.amount)} untuk {decision.name} sudah ditransfer ke{' '}
            {decision.request.holderName}?
          </p>
        ) : (
          <>
            {decisionError && <Notice tone="error">{decisionError}</Notice>}
            <p>
              Saldo pengajuan {money(decision?.request.amount ?? 0)} akan dikembalikan kepada{' '}
              {decision?.name}.
            </p>
            <TextArea
              label="Alasan penolakan"
              hint="Minimal 3 karakter."
              required
              autoFocus
              maxLength={200}
              value={decision?.reason ?? ''}
              onChange={(event) =>
                setDecision((current) =>
                  current ? { ...current, reason: event.target.value } : current,
                )
              }
            />
          </>
        )}
      </Dialog>
    </Card>
  );
}
function Accounts({ onChange }: { onChange: () => void }) {
  const list = useFetch<Account[]>('staff', '/admin/affiliate/accounts');
  const call = useApiCall('staff');
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function review(parentId: string, approved: boolean) {
    if (lock.current) return;
    const note = approved ? '' : window.prompt('Alasan penolakan')?.trim();
    if (!approved && !note) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await call(`/admin/affiliate/accounts/${parentId}/review`, {
        method: 'POST',
        body: { approved, note },
      });
      list.reload();
      onChange();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (list.loading && !list.data) return <Spinner label="Memuat rekening" />;
  if (!list.data) return <Notice tone="error">{errorMessage(list.error)}</Notice>;
  return (
    <Card>
      <h2>Verifikasi rekening</h2>
      {message && <Notice tone="error">{message}</Notice>}
      {!list.data.length ? (
        <p>Belum ada rekening.</p>
      ) : (
        <div className="aff-table-wrap">
          <table className="aff-table">
            <thead>
              <tr>
                <th>Orang tua</th>
                <th>Bank / e-wallet</th>
                <th>Nama rekening</th>
                <th>No. rekening</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map(({ account: a, name }) => (
                <tr key={a.parentId}>
                  <td>{name}</td>
                  <td>{a.providerName}</td>
                  <td>{a.holderName}</td>
                  <td className="afp-account-number">{a.accountNumber}</td>
                  <td>
                    {a.status}
                    {a.reviewNote && ` · ${a.reviewNote}`}
                  </td>
                  <td>
                    {a.status === 'pending' && (
                      <div className="aff-actions">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void review(a.parentId, true)}
                        >
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => void review(a.parentId, false)}
                        >
                          Tolak
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Settings() {
  const source = useFetch<AffiliateSettings>('staff', '/admin/affiliate/settings');
  const call = useApiCall('staff');
  const [draft, setDraft] = useState<AffiliateSettings>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const settings = draft ?? source.data;
  if (source.loading && !settings) return <Spinner label="Memuat pengaturan" />;
  if (!settings) return <Notice tone="error">{errorMessage(source.error)}</Notice>;
  const numberFields: { key: keyof AffiliateSettings; label: string; hint: string }[] = [
    {
      key: 'signupBonus',
      label: 'Bonus ajak teman (Rp)',
      hint: 'Diberikan setelah teman memenuhi syarat',
    },
    { key: 'commissionBp', label: 'Komisi paket (basis poin)', hint: '3300 berarti 33%' },
    {
      key: 'minPayout',
      label: 'Minimal pencairan (Rp)',
      hint: 'Jumlah minimum yang boleh diajukan',
    },
    {
      key: 'holdDays',
      label: 'Masa tahan komisi (hari)',
      hint: 'Komisi baru tersedia setelah masa ini',
    },
    {
      key: 'qualifyRounds',
      label: 'Ronde syarat bonus',
      hint: 'Anak teman perlu menyelesaikan ronde ini',
    },
    {
      key: 'qualifyDays',
      label: 'Batas waktu bonus (hari)',
      hint: 'Dihitung sejak teman mendaftar',
    },
    { key: 'monthlyBonusCap', label: 'Batas bonus per bulan', hint: '0 berarti tanpa batas' },
    { key: 'accountCooldownDays', label: 'Jeda rekening (hari)', hint: 'Setelah rekening diubah' },
  ];
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await call('/admin/affiliate/settings', { method: 'PUT', body: settings });
      source.reload();
      setDraft(undefined);
      setMessage('Pengaturan afiliasi tersimpan.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>Aturan afiliasi</h2>
      <p>
        Perubahan angka berlaku untuk bonus dan komisi baru. Riwayat lama tetap memakai nilai saat
        dicatat.
      </p>
      {message && <Notice tone="info">{message}</Notice>}
      <form className="aff-form" onSubmit={(event) => void save(event)}>
        <label className="aff-checkbox">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setDraft({ ...settings, enabled: e.target.checked })}
          />{' '}
          Program aktif
        </label>
        <div className="aff-settings-grid">
          {numberFields.map(({ key, label, hint }) => (
            <TextField
              key={key}
              type="number"
              label={label}
              hint={hint}
              min={0}
              value={settings[key] as number}
              onChange={(e) => setDraft({ ...settings, [key]: Number(e.target.value) })}
              required
            />
          ))}
        </div>
        <h3>Bank dan e-wallet tersedia</h3>
        <div className="aff-providers">
          {settings.providers.map((provider, i) => (
            <div key={`${provider.id}-${i}`}>
              <input
                aria-label={`Kode penyedia ${i + 1}`}
                value={provider.id}
                onChange={(e) =>
                  setDraft({
                    ...settings,
                    providers: settings.providers.map((p, n) =>
                      n === i ? { ...p, id: e.target.value } : p,
                    ),
                  })
                }
              />
              <input
                aria-label={`Nama penyedia ${i + 1}`}
                value={provider.name}
                onChange={(e) =>
                  setDraft({
                    ...settings,
                    providers: settings.providers.map((p, n) =>
                      n === i ? { ...p, name: e.target.value } : p,
                    ),
                  })
                }
              />
              <select
                aria-label={`Jenis penyedia ${i + 1}`}
                value={provider.kind}
                onChange={(e) =>
                  setDraft({
                    ...settings,
                    providers: settings.providers.map((p, n) =>
                      n === i ? { ...p, kind: e.target.value as 'bank' | 'ewallet' } : p,
                    ),
                  })
                }
              >
                <option value="bank">Bank</option>
                <option value="ewallet">E-wallet</option>
              </select>
              <Button
                variant="danger"
                size="sm"
                disabled={settings.providers.length <= 1}
                onClick={() =>
                  setDraft({ ...settings, providers: settings.providers.filter((_, n) => n !== i) })
                }
              >
                Hapus
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            setDraft({
              ...settings,
              providers: [...settings.providers, { id: '', name: '', kind: 'bank' }],
            })
          }
        >
          Tambah penyedia
        </Button>
        <Button type="submit" disabled={busy}>
          Simpan pengaturan
        </Button>
      </form>
    </Card>
  );
}
