import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMockDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import { ChildLogin } from '../src/play/ChildLogin';
import { TopicPage } from '../src/play/TopicPage';
import { ParentApp } from '../src/parent/ParentApp';
import { AppShell } from '../src/ui/AppShell';
import { Landing } from '../src/site/Landing';

beforeEach(() => {
  resetMockDb();
  useSession.setState({ session: null });
  try {
    localStorage.clear();
  } catch {
    /* diabaikan */
  }
});

describe('navigasi dan kerangka', () => {
  it('halaman masuk anak punya navbar dengan tautan kembali ke beranda', () => {
    render(
      <MemoryRouter initialEntries={['/play/masuk']}>
        <Routes>
          <Route path="/play/masuk" element={<ChildLogin />} />
          <Route path="/" element={<p>Beranda situs</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const back = screen.getByRole('link', { name: /Kembali ke Beranda/ });
    expect(back).toHaveAttribute('href', '/');
    fireEvent.click(back);
    expect(screen.getByText('Beranda situs')).toBeInTheDocument();
  });

  it('landing punya menu bagian dan tombol masuk', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'UdaKids' });
    for (const label of [
      'Tentang',
      'Buku',
      'Mata pelajaran',
      'Fitur baru',
      'Cara main',
      'Harga',
      'Aman',
    ])
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Area orang tua' }))
      expect(link).toHaveAttribute('href', '/orang-tua/masuk');
    expect(screen.getByRole('heading', { name: 'Buku dan topik' })).toBeInTheDocument();
  });

  it('sidebar bisa disembunyikan dan pilihan diingat', () => {
    render(
      <MemoryRouter>
        <AppShell
          id="uji"
          brand={<span>Uji</span>}
          navLabel="Menu uji"
          nav={[{ to: '/', label: 'Beranda', icon: 'home', end: true }]}
          user={{ name: 'Ridho Dwi Syahputra', caption: 'Masuk sebagai' }}
          onLogout={() => undefined}
        >
          <p>isi</p>
        </AppShell>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: 'Sembunyikan menu' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Tampilkan menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(localStorage.getItem('lc.sidebar.uji')).toBe('1');
  });

  it('kerangka orang tua: menu, lencana pesanan, tombol main, dan keluar', async () => {
    useSession.setState({
      session: { token: 'mock-parent:p-demo', role: 'parent', name: 'Ridho Dwi Syahputra' },
    });
    render(
      <MemoryRouter initialEntries={['/orang-tua']}>
        <Routes>
          <Route path="/orang-tua/*" element={<ParentApp />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link', { name: 'Paket & Pembayaran' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Afiliasi/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /mode gelap/i })).toBeNull();
    expect(await screen.findByRole('link', { name: /Riwayat Transaksi, 1/ })).toBeInTheDocument();
    expect(screen.getAllByText('Ridho Dwi Syahputra').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Keluar' })[0]!);
    await waitFor(() => expect(useSession.getState().session).toBeNull());
    expect((await screen.findAllByText('Masuk orang tua')).length).toBeGreaterThan(0);
  });
});

describe('contoh soal di halaman topik', () => {
  it('bisa dicoba tanpa dinilai dan memberi petunjuk', async () => {
    useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });
    render(
      <MemoryRouter initialEntries={['/play/topik/matematika-kelas-1:A']}>
        <Routes>
          <Route path="/play/topik/:id" element={<TopicPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Coba contoh soal' }));
    expect(screen.getByText('Contoh soal, tidak dinilai')).toBeInTheDocument();
    const choice = screen.getAllByRole('button').find((b) => b.className.includes('choice'))!;
    fireEvent.click(choice);
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status.textContent).toMatch(/Tepat|Belum tepat/));
    expect(status.textContent?.toLowerCase()).not.toContain('salah');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  it('kartu level ada di grid dan level terkunci tidak bisa dibuka', async () => {
    useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });
    const { container } = render(
      <MemoryRouter initialEntries={['/play/topik/matematika-kelas-1:A']}>
        <Routes>
          <Route path="/play/topik/:id" element={<TopicPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findAllByText('Bilangan sampai 100');
    expect(container.querySelector('ol.level-path')).not.toBeNull();
    expect(container.querySelectorAll('.level-card')).toHaveLength(3);
    expect(container.querySelectorAll('.level-card.is-locked')).toHaveLength(2);
    expect(container.querySelector('.level-card.is-next')).not.toBeNull();
  });
});
