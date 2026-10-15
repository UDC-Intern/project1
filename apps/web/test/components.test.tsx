import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RequireRole } from '../src/auth/RequireRole';
import { useSession } from '../src/auth/store';
import { CountObjects } from '../src/components/CountObjects';
import { PicturePin } from '../src/components/PicturePin';
import { Plant } from '../src/components/Plant';
import { isMocked } from '../src/api/mode';
import { translate } from '../src/i18n';
import { useState } from 'react';
import type { PinPicture } from '@udakids/engine';

function PinHarness() {
  const [v, setV] = useState<PinPicture[]>([]);
  return <PicturePin value={v} onChange={setV} />;
}

describe('komponen dasar', () => {
  it('sandi gambar menerima maksimal 3 gambar', () => {
    render(<PinHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Apel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bintang' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ikan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bola' }));
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
  });

  it('hitung objek menjumlahkan semua kelompok', () => {
    render(<CountObjects visual={{ item: 'apple', groups: [3, 2] }} />);
    expect(screen.getByRole('img', { name: '5 apel' })).toBeInTheDocument();
  });

  it('tanaman punya teks alternatif per tahap', () => {
    render(<Plant stage={3} />);
    expect(screen.getByRole('img', { name: 'Pohon berbuah' })).toBeInTheDocument();
  });
});

describe('penjagaan peran', () => {
  const tree = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireRole role="parent" />}>
          <Route path="/orang-tua" element={<p>Beranda orang tua</p>} />
        </Route>
        <Route path="/orang-tua/masuk" element={<p>Masuk orang tua</p>} />
        <Route path="/play" element={<p>Beranda anak</p>} />
      </Routes>
    </MemoryRouter>
  );

  it('tanpa sesi diarahkan ke halaman masuk', () => {
    useSession.setState({ session: null });
    render(tree('/orang-tua'));
    expect(screen.getByText('Masuk orang tua')).toBeInTheDocument();
  });

  it('sesi peran lain diarahkan ke beranda perannya', () => {
    useSession.setState({ session: { token: 't', role: 'child', name: 'Ayu' } });
    render(tree('/orang-tua'));
    expect(screen.getByText('Beranda anak')).toBeInTheDocument();
  });

  it('peran sesuai boleh masuk', () => {
    useSession.setState({ session: { token: 't', role: 'parent', name: 'Bu Ani' } });
    render(tree('/orang-tua'));
    expect(screen.getByText('Beranda orang tua')).toBeInTheDocument();
  });
});

describe('mode data dan teks', () => {
  it('"*" menandai semua modul memakai data tiruan', () => {
    expect(isMocked('auth', '*')).toBe(true);
    expect(isMocked('admin', 'auth, parent')).toBe(false);
    expect(isMocked('parent', 'auth, parent')).toBe(true);
  });

  it('i18n mengganti variabel dan mengembalikan kunci bila tidak ada', () => {
    expect(translate('common', 'back')).toBe('Kembali');
    expect(translate('common', 'tidak.ada')).toBe('tidak.ada');
  });
});
