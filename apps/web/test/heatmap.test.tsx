import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { DashboardPage } from '../src/admin/overview/DashboardPage';
import { insights } from '../src/api/mock/insights';
import { readDb, resetMockDb, writeDb, type MockRound } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import { ColumnChart, Heatmap, LineChart, heatLevel } from '../src/ui/adminCharts';

const ADMIN = 'mock-admin:a-demo';

beforeEach(() => {
  resetMockDb();
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
});

describe('tingkat keramaian sel', () => {
  it('Sangat Ramai dari dua pertiga nilai terbesar, Sedang dari seperempat, selebihnya Tenang', () => {
    expect(heatLevel(100, 100)).toBe('busy');
    expect(heatLevel(66, 100)).toBe('busy');
    expect(heatLevel(65, 100)).toBe('medium');
    expect(heatLevel(25, 100)).toBe('medium');
    expect(heatLevel(24, 100)).toBe('quiet');
    expect(heatLevel(0, 100)).toBe('quiet');
    expect(heatLevel(5, 0)).toBe('quiet');
  });
});

describe('Heatmap', () => {
  const matrix = [
    [0, 4, 8],
    [2, 0, 6],
  ];
  const view = () =>
    render(
      <Heatmap
        matrix={matrix}
        rowLabels={['Sen', 'Sel']}
        colLabels={['00', '01', '02']}
        ariaLabel="Jam paling aktif"
        label={({ row, col, value }) => `baris ${row} kolom ${col}: ${value}`}
        tip={({ value, max }) => (
          <span>
            {value} dari {max}
          </span>
        )}
      />,
    );

  it('menampilkan semua sel dengan nama lengkap untuk pembaca layar', () => {
    view();
    expect(screen.getByRole('grid', { name: 'Jam paling aktif' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(6);
    expect(screen.getByRole('gridcell', { name: 'baris 0 kolom 2: 8' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Sel' })).toBeInTheDocument();
  });

  it('kursor ke sel membuka popover dengan rincian, dan keluar menutupnya', () => {
    view();
    const cell = screen.getByRole('gridcell', { name: 'baris 1 kolom 2: 6' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(cell);
    expect(screen.getByRole('tooltip')).toHaveTextContent('6 dari 8');
    fireEvent.mouseLeave(cell);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('papan ketik: satu sel bisa dicapai dengan Tab, panah berpindah sel dan membuka popover, Esc menutup', () => {
    view();
    const cells = screen.getAllByRole('gridcell');
    expect(cells.filter((c) => c.tabIndex === 0)).toHaveLength(1);

    act(() => cells[0]!.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('0 dari 8');
    fireEvent.keyDown(cells[0]!, { key: 'ArrowRight' });
    expect(cells[1]).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('4 dari 8');
    fireEvent.keyDown(cells[1]!, { key: 'ArrowDown' });
    expect(cells[4]).toHaveFocus();
    fireEvent.keyDown(cells[4]!, { key: 'End' });
    expect(cells[5]).toHaveFocus();
    // Di tepi, panah tidak keluar dari kotak.
    fireEvent.keyDown(cells[5]!, { key: 'ArrowRight' });
    expect(cells[5]).toHaveFocus();
    fireEvent.keyDown(cells[5]!, { key: 'Home' });
    expect(cells[3]).toHaveFocus();
    // Sel yang terakhir difokuskan menjadi satu-satunya tujuan Tab.
    expect(cells.filter((c) => c.tabIndex === 0)).toEqual([cells[3]]);

    fireEvent.keyDown(cells[3]!, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Grafik pendapatan', () => {
  it('setiap hari, termasuk nol pesanan, menampilkan rincian saat diarahkan atau difokuskan', () => {
    render(
      <ColumnChart
        labels={['18/10', '19/10']}
        values={[0, 25000]}
        describe={(index) => `${index + 18} Oktober: ${index} pesanan`}
        detail={(index) => (
          <span>
            {index} pesanan · Rp{index * 25000}
          </span>
        )}
      />,
    );
    const empty = screen.getByRole('button', { name: '18 Oktober: 0 pesanan' });
    fireEvent.mouseEnter(empty);
    expect(screen.getByRole('tooltip')).toHaveTextContent('0 pesanan · Rp0');
    fireEvent.mouseLeave(empty);
    expect(screen.queryByRole('tooltip')).toBeNull();
    const paid = screen.getByRole('button', { name: '19 Oktober: 1 pesanan' });
    fireEvent.focus(paid);
    expect(screen.getByRole('tooltip')).toHaveTextContent('1 pesanan · Rp25000');
    fireEvent.blur(paid);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Grafik aktivitas dan kelulusan', () => {
  it('titik ronde harian membuka angka dan pembanding rata-rata saat difokuskan', () => {
    render(
      <LineChart
        labels={['18/10', '19/10']}
        series={[
          { label: 'Rata-rata periode', values: [5, 5], dashed: true },
          { label: 'Ronde', values: [3, 7] },
        ]}
        describe={(index) => `${index + 18} Oktober: ${index ? 7 : 3} ronde`}
        detail={(index) => <span>{index ? 7 : 3} ronde; rata-rata 5</span>}
      />,
    );
    const day = screen.getByRole('button', { name: '19 Oktober: 7 ronde' });
    fireEvent.focus(day);
    expect(screen.getByRole('tooltip')).toHaveTextContent('7 ronde; rata-rata 5');
    fireEvent.blur(day);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('buku dengan ronde tetapi 0% lulus menampilkan batang kosong', async () => {
    const db = readDb();
    db.rounds['demo-failed'] = {
      id: 'demo-failed',
      childId: 'c-ayu',
      levelId: 'sains-kelas-1:A:1',
      seed: 1,
      startedAt: Date.now() - 60_000,
      stageBefore: 0,
      answers: {},
      finishedAt: Date.now(),
      result: { score: 60, correct: 6, wrong: 4, durationMs: 60_000, passed: false },
    };
    writeDb(db);
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText('Kelulusan per buku');
    const row = [...document.querySelectorAll('.dash-books li')].find((el) =>
      el.textContent?.includes('Sains Kelas 1'),
    );
    expect(row).toHaveTextContent('0%');
    expect(row?.querySelector('.ch-meter > span')).toHaveStyle({ width: '0%' });
  });
});

describe('Jam ramai di dasbor admin', () => {
  const open = async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    return screen.findByRole('grid', { name: 'Jam paling aktif' });
  };

  it('berderet 24 jam penuh: 7 hari x 24 jam, label jam tiap tiga jam dari 00 sampai 21', async () => {
    const grid = await open();
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(7 * 24);
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(24);
    for (const hour of ['00', '03', '12', '21'])
      expect(within(grid).getByText(hour)).toBeInTheDocument();
    expect(within(grid).getByRole('rowheader', { name: 'Min' })).toBeInTheDocument();
  });

  it('popover memuat hari dan jam lengkap, jumlah ronde, anak aktif, dan status keramaian', async () => {
    const grid = await open();
    const cells = within(grid).getAllByRole('gridcell');
    // Senin (baris pertama) pukul 19 (kolom ke-20).
    const monday19 = cells[19]!;
    expect(monday19).toHaveAccessibleName(
      /^Senin, Pukul 19:00 - 19:59 WIB\. \d[\d.]* ronde diselesaikan\. \d[\d.]* anak aktif$/,
    );
    fireEvent.mouseEnter(monday19);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Senin, Pukul 19:00 - 19:59 WIB');
    expect(tip).toHaveTextContent(/ronde diselesaikan/);
    expect(tip).toHaveTextContent(/anak aktif/);
    expect(within(tip).getByText(/^(Sangat Ramai|Sedang|Tenang)$/)).toBeInTheDocument();

    // Pukul 03 dini hari di data contoh: tenang.
    fireEvent.mouseLeave(monday19);
    fireEvent.mouseEnter(cells[3]!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Senin, Pukul 03:00 - 03:59 WIB');
    expect(within(screen.getByRole('tooltip')).getByText('Tenang')).toBeInTheDocument();
  });
});

describe('data jam ramai (API tiruan)', () => {
  const round = (id: string, childId: string, finishedAt: number): MockRound => ({
    id,
    childId,
    levelId: 'matematika-kelas-1:A:1',
    seed: 1,
    startedAt: finishedAt - 60_000,
    stageBefore: 0,
    answers: {},
    finishedAt,
    result: { score: 80, correct: 8, wrong: 2, durationMs: 60_000, passed: true },
  });

  /** Waktu UTC pada hari Senin terakhir (dalam beberapa hari terakhir) pukul `hh:mm`. */
  const lastMondayUtc = (hh: number, mm: number) => {
    const d = new Date();
    d.setUTCHours(hh, mm, 0, 0);
    while (d.getUTCDay() !== 1 || d.getTime() > Date.now() - 60_000)
      d.setUTCDate(d.getUTCDate() - 1);
    return d.getTime();
  };

  it('data contoh: 24 kolom, ramai sepulang sekolah dan sepi dini hari, anak tidak lebih banyak dari ronde', async () => {
    const data = await insights(ADMIN, '7d');
    expect(data.sample).toBe(true);
    expect(data.heatmap).toHaveLength(7);
    expect(data.heatmap.every((row) => row.length === 24)).toBe(true);
    expect(data.heatmapChildren.map((row) => row.length)).toEqual(Array(7).fill(24));
    const hours = (from: number, to: number) =>
      data.heatmap.reduce((n, row) => n + row.slice(from, to + 1).reduce((a, b) => a + b, 0), 0);
    expect(hours(15, 20)).toBeGreaterThan(hours(0, 4) * 3);
    data.heatmap.forEach((row, d) =>
      row.forEach((n, h) => {
        const kids = data.heatmapChildren[d]![h]!;
        expect(kids).toBeLessThanOrEqual(n);
        expect(n === 0 ? kids === 0 : kids >= 1).toBe(true);
      }),
    );
  });

  it('data nyata dibaca dalam WIB: jam, hari, dan jumlah anak berbeda per sel', async () => {
    const db = readDb();
    const monday1230 = lastMondayUtc(12, 30); // Senin 19.30 WIB
    const rounds = [
      ['a', 'c-1'],
      ['b', 'c-1'],
      ['c', 'c-2'],
      ['d', 'c-2'],
      ['e', 'c-3'],
      ['f', 'c-3'],
      ['g', 'c-3'],
      ['h', 'c-3'],
    ] as const;
    rounds.forEach(([id, kid], i) => (db.rounds[id] = round(id, kid, monday1230 + i * 1000)));
    // Senin 17.30 UTC = Selasa 00.30 WIB: masuk baris Selasa, kolom 00.
    db.rounds.z = round('z', 'c-9', lastMondayUtc(17, 30));
    writeDb(db);

    const data = await insights(ADMIN, '30d');
    expect(data.sample).toBe(false);
    expect(data.heatmap[0]![19]).toBe(8);
    expect(data.heatmapChildren[0]![19]).toBe(3);
    expect(data.heatmap[1]![0]).toBe(1);
    expect(data.heatmapChildren[1]![0]).toBe(1);
    expect(data.heatmap.flat().reduce((a, b) => a + b, 0)).toBe(9);
  });
});
