import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersPage } from '../src/admin/billing/OrdersPage';
import { PackagesPage } from '../src/admin/billing/PackagesPage';
import { PaymentMethodsPage } from '../src/admin/billing/PaymentMethodsPage';
import { SettingsPage } from '../src/admin/billing/SettingsPage';
import { useConfirm } from '../src/admin/common';
import { IllustrationsPage } from '../src/admin/media/IllustrationsPage';
import { readDb, resetMockDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';

const nativeConfirm = vi.fn(() => true);

beforeEach(() => {
  resetMockDb();
  nativeConfirm.mockClear();
  // Kotak bawaan peramban ("localhost says") tidak boleh dipakai lagi di mana pun.
  vi.spyOn(window, 'confirm').mockImplementation(nativeConfirm);
  useSession.setState({ session: { token: 'mock-admin:a-demo', role: 'admin', name: 'Admin' } });
});

afterEach(() => {
  expect(nativeConfirm).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

function Harness({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  const { ask, dialog } = useConfirm();
  return (
    <>
      <button
        onClick={() =>
          void ask({
            title: 'Hapus A?',
            message: 'Yakin hapus A?',
            confirmLabel: 'Ya, hapus A',
          }).then(onAnswer)
        }
      >
        buka A
      </button>
      <button
        onClick={() => void ask({ title: 'Hapus B?', message: 'Yakin hapus B?' }).then(onAnswer)}
      >
        buka B
      </button>
      {dialog}
    </>
  );
}

describe('useConfirm: pop-up ya atau tidak di dalam aplikasi', () => {
  it('tombol bawaan "Ya, lanjutkan" dan "Tidak"; jawaban ya menghasilkan true', async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('buka B'));
    const dialog = await screen.findByRole('dialog', { name: 'Hapus B?' });
    expect(within(dialog).getByText('Yakin hapus B?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tidak' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, lanjutkan' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Tidak, Esc, atau ketuk di luar kotak menghasilkan false dan menutup pop-up', async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);

    fireEvent.click(screen.getByText('buka A'));
    let dialog = await screen.findByRole('dialog', { name: 'Hapus A?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByText('buka A'));
    dialog = await screen.findByRole('dialog', { name: 'Hapus A?' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByText('buka A'));
    dialog = await screen.findByRole('dialog', { name: 'Hapus A?' });
    fireEvent.click(dialog);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(3));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });

  it('teks tombol ya bisa diganti; pertanyaan baru menjawab "tidak" untuk yang lama', async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('buka A'));
    const first = await screen.findByRole('dialog', { name: 'Hapus A?' });
    expect(within(first).getByRole('button', { name: 'Ya, hapus A' })).toBeInTheDocument();

    // Dua pertanyaan beruntun: yang pertama otomatis dijawab "tidak", yang kedua dijawab "ya".
    fireEvent.click(screen.getByText('buka B'));
    const second = await screen.findByRole('dialog', { name: 'Hapus B?' });
    expect(onAnswer).toHaveBeenCalledWith(false);
    fireEvent.click(within(second).getByRole('button', { name: 'Ya, lanjutkan' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer.mock.calls.map((c) => c[0])).toEqual([false, true]);
  });

  it('komponen dilepas saat pop-up terbuka: dijawab "tidak", tidak menggantung', async () => {
    const onAnswer = vi.fn();
    const view = render(<Harness onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('buka A'));
    await screen.findByRole('dialog', { name: 'Hapus A?' });
    view.unmount();
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });
});

const inPage = (page: ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('halaman admin memakai pop-up ya atau tidak, bukan kotak bawaan peramban', () => {
  it('Paket: hapus meminta konfirmasi; Tidak membiarkan paket, Ya menghapusnya', async () => {
    const before = readDb().packages;
    const target = before[before.length - 1]!;
    inPage(<PackagesPage />);
    const del = await screen.findByRole('button', { name: `Hapus paket ${target.name}` });

    fireEvent.click(del);
    let dialog = await screen.findByRole('dialog', { name: 'Hapus paket?' });
    expect(
      within(dialog).getByText(new RegExp(`Hapus paket ${target.name}\\?`)),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().packages).toHaveLength(before.length);

    fireEvent.click(del);
    dialog = await screen.findByRole('dialog', { name: 'Hapus paket?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }));
    expect(
      await screen.findByText(new RegExp(`Paket ${target.name} (dihapus|sudah pernah dipesan)`)),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const after = readDb().packages.find((p) => p.id === target.id);
    expect(after === undefined || after.active === false).toBe(true);
  });

  it('Rekening: hapus meminta konfirmasi; Tidak membiarkan, Ya menghapus', async () => {
    const before = readDb().methods;
    const target = before[before.length - 1]!;
    inPage(<PaymentMethodsPage />);
    const del = await screen.findByRole('button', { name: `Hapus rekening ${target.name}` });

    fireEvent.click(del);
    let dialog = await screen.findByRole('dialog', { name: 'Hapus rekening?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().methods).toHaveLength(before.length);

    fireEvent.click(del);
    dialog = await screen.findByRole('dialog', { name: 'Hapus rekening?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }));
    expect(await screen.findByText(`Rekening ${target.name} dihapus.`)).toBeInTheDocument();
    expect(readDb().methods).toHaveLength(before.length - 1);
  });

  it('Pesanan: Setujui pembayaran meminta konfirmasi; Tidak tidak mengubah, Ya menyetujui', async () => {
    const order = Object.values(readDb().orders).find(
      (o) => o.status !== 'paid' && o.status !== 'cancelled',
    )!;
    inPage(<OrdersPage />);
    fireEvent.click(await screen.findByRole('tab', { name: /^Semua/ }));
    fireEvent.click(await screen.findByRole('button', { name: `Detail pesanan ${order.number}` }));

    fireEvent.click(await screen.findByRole('button', { name: 'Setujui pembayaran' }));
    let dialog = await screen.findByRole('dialog', { name: 'Setujui pesanan?' });
    expect(
      within(dialog).getByText(new RegExp(`Setujui pesanan ${order.number}`)),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().orders[order.id]!.status).toBe(order.status);

    fireEvent.click(screen.getByRole('button', { name: 'Setujui pembayaran' }));
    dialog = await screen.findByRole('dialog', { name: 'Setujui pesanan?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, setujui' }));
    expect(
      await screen.findByText(`Pesanan ${order.number} disetujui. Premium sudah aktif.`),
    ).toBeInTheDocument();
    expect(readDb().orders[order.id]!.status).toBe('paid');
  });

  it('Ilustrasi: hapus meminta konfirmasi; Tidak membiarkan, Ya menghapus', async () => {
    inPage(<IllustrationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Buat ilustrasi/ }));
    expect(await screen.findByText(/dibuat dan menunggu ditinjau/)).toBeInTheDocument();
    expect(readDb().illustrations).toHaveLength(1);

    fireEvent.click(await screen.findByRole('button', { name: 'Hapus' }));
    let dialog = await screen.findByRole('dialog', { name: 'Hapus ilustrasi?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().illustrations).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    dialog = await screen.findByRole('dialog', { name: 'Hapus ilustrasi?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }));
    expect(await screen.findByText(/dihapus\./)).toBeInTheDocument();
    expect(readDb().illustrations).toHaveLength(0);
  });

  it('Pengaturan: hapus data contoh meminta konfirmasi; Tidak membiarkan, Ya mengosongkan', async () => {
    inPage(<SettingsPage />);
    // Data contoh belum dimuat secara bawaan: dimuat dulu, baru tombol hapus muncul.
    fireEvent.click(await screen.findByRole('button', { name: 'Muat data contoh' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus data contoh' }));
    let dialog = await screen.findByRole('dialog', { name: 'Hapus data contoh?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('Data contoh dihapus.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus data contoh' }));
    dialog = await screen.findByRole('dialog', { name: 'Hapus data contoh?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }));
    expect(await screen.findByText('Data contoh dihapus.')).toBeInTheDocument();
  });
});
