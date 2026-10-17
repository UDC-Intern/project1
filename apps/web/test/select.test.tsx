import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Segmented, Stepper, Switch } from '../src/ui/controls';
import { Dialog } from '../src/ui/Dialog';
import { Select, type SelectOption } from '../src/ui/Select';
import { SelectField } from '../src/ui/ui';

const OPTIONS: SelectOption[] = [
  { value: 'outdoor', label: 'Langit dan rumput' },
  { value: 'classroom', label: 'Ruang kelas' },
  { value: 'plain', label: 'Polos' },
  { value: 'night', label: 'Malam', disabled: true },
];

/** Pembungkus dengan nilai tersimpan, supaya tes bisa melihat nilai terakhir. */
function Harness({
  initial = 'outdoor',
  onChange,
}: {
  initial?: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SelectField
      label="Latar"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

const trigger = () => screen.getByRole('combobox', { name: 'Latar' });
const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });

describe('Select: dropdown bergaya', () => {
  it('menampilkan nilai terpilih, membuka daftar, dan memilih dengan klik', () => {
    const changed = vi.fn();
    render(<Harness onChange={changed} />);
    expect(trigger()).toHaveTextContent('Langit dan rumput');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(trigger());
    const list = screen.getByRole('listbox', { name: 'Latar' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Langit dan rumput',
      'Ruang kelas',
      'Polos',
      'Malam',
    ]);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[3]).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(options[1]!);
    expect(changed).toHaveBeenCalledWith('classroom');
    expect(trigger()).toHaveTextContent('Ruang kelas');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('klik membuka daftar dan memindahkan fokus ke pemicu, supaya papan ketik langsung bekerja', () => {
    render(<Harness />);
    expect(trigger()).not.toHaveFocus();
    fireEvent.click(trigger());
    expect(trigger()).toHaveFocus();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('pilihan yang nonaktif tidak bisa dipilih dan memilih nilai yang sama tidak memanggil onChange', () => {
    const changed = vi.fn();
    render(<Harness onChange={changed} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'Malam' }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Langit dan rumput' }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('papan ketik: panah membuka, panah memilih, Enter menyimpan', () => {
    const changed = vi.fn();
    render(<Harness onChange={changed} />);
    trigger().focus();
    key(trigger(), 'ArrowDown');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Daftar terbuka di pilihan yang sedang terpilih.
    expect(trigger()).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[0]!.id,
    );
    key(trigger(), 'ArrowDown');
    key(trigger(), 'ArrowDown');
    // Pilihan nonaktif dilewati: berhenti di "Polos".
    key(trigger(), 'ArrowDown');
    expect(trigger()).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[2]!.id,
    );
    key(trigger(), 'Enter');
    expect(changed).toHaveBeenCalledWith('plain');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Home, End, dan ketik huruf awal melompat ke pilihan yang cocok', () => {
    render(<Harness initial="classroom" />);
    trigger().focus();
    key(trigger(), 'ArrowDown');
    key(trigger(), 'Home');
    expect(trigger()).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[0]!.id,
    );
    key(trigger(), 'End');
    expect(trigger()).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[2]!.id,
    );
    key(trigger(), 'r');
    expect(trigger()).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[1]!.id,
    );
    key(trigger(), ' ');
    expect(trigger()).toHaveTextContent('Ruang kelas');
  });

  it('Esc menutup daftar tanpa mengubah nilai; Tab juga menutup', () => {
    const changed = vi.fn();
    render(<Harness onChange={changed} />);
    fireEvent.click(trigger());
    key(trigger(), 'ArrowDown');
    key(trigger(), 'Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(trigger());
    key(trigger(), 'Tab');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('klik di luar menutup daftar; klik pemicu lagi juga', () => {
    render(
      <>
        <Harness />
        <button type="button">Di luar</button>
      </>,
    );
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Di luar' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Esc di dalam dialog hanya menutup daftar, bukan dialognya', () => {
    const closed = vi.fn();
    render(
      <Dialog title="Pengaturan" onClose={closed}>
        <Harness />
      </Dialog>,
    );
    fireEvent.click(trigger());
    key(trigger(), 'Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(closed).not.toHaveBeenCalled();
    // Dengan daftar tertutup, Esc menutup dialog seperti biasa.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('nonaktif tidak bisa dibuka; nilai tak dikenal menampilkan placeholder', () => {
    render(
      <>
        <Select
          value="x"
          options={OPTIONS}
          onChange={() => undefined}
          placeholder="Pilih latar"
          aria-label="Latar kosong"
        />
        <Select
          value="outdoor"
          options={OPTIONS}
          onChange={() => undefined}
          disabled
          aria-label="Kunci"
        />
      </>,
    );
    expect(screen.getByRole('combobox', { name: 'Latar kosong' })).toHaveTextContent('Pilih latar');
    const locked = screen.getByRole('combobox', { name: 'Kunci' });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('bidang berlabel: label menjadi nama pemicu dan keterangan terhubung', () => {
    render(
      <SelectField
        label="Kelas"
        hint="Pilih satu."
        value="1"
        options={[
          { value: '1', label: 'Kelas 1' },
          { value: '2', label: 'Kelas 2' },
        ]}
        onChange={() => undefined}
      />,
    );
    const select = screen.getByLabelText('Kelas');
    expect(select).toHaveAttribute('role', 'combobox');
    expect(select).toHaveAccessibleDescription('Pilih satu.');
  });
});

describe('Switch, Segmented, dan Stepper', () => {
  it('sakelar berubah lewat tombol maupun labelnya', () => {
    const changed = vi.fn();
    function Demo() {
      const [on, setOn] = useState(false);
      return (
        <Switch
          checked={on}
          onChange={(v) => {
            changed(v);
            setOn(v);
          }}
          label="Kunci berbayar"
          hint="Bila mati, semua gratis."
        />
      );
    }
    render(<Demo />);
    const sw = screen.getByRole('switch', { name: 'Kunci berbayar' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription('Bila mati, semua gratis.');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('Kunci berbayar'));
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });

  it('pilihan segmen menandai yang dipilih, menolak yang nonaktif, dan tidak mengulang pilihan sama', () => {
    const changed = vi.fn();
    render(
      <Segmented
        label="Akses level 1"
        value="free"
        onChange={changed}
        options={[
          { value: 'free', label: 'Gratis' },
          { value: 'premium', label: 'Premium', disabled: true },
          { value: 'none', label: 'Tidak ada' },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Akses level 1' });
    expect(within(group).getByRole('button', { name: 'Gratis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(group).getByRole('button', { name: 'Gratis' }));
    expect(changed).not.toHaveBeenCalled();
    expect(within(group).getByRole('button', { name: 'Premium' })).toBeDisabled();
    fireEvent.click(within(group).getByRole('button', { name: 'Tidak ada' }));
    expect(changed).toHaveBeenCalledWith('none');
  });

  it('stepper: tombol dan ketikan dijepit ke batas', () => {
    const changed = vi.fn();
    function Demo() {
      const [n, setN] = useState(2);
      return (
        <Stepper
          value={n}
          min={1}
          max={4}
          label="Level gratis"
          onChange={(v) => {
            changed(v);
            setN(v);
          }}
        />
      );
    }
    render(<Demo />);
    const input = screen.getByRole('spinbutton', { name: 'Level gratis' });
    fireEvent.click(screen.getByRole('button', { name: 'Tambah' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tambah' }));
    expect(input).toHaveValue(4);
    expect(screen.getByRole('button', { name: 'Tambah' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '9' } });
    // Angka di luar batas belum diteruskan; saat selesai mengetik nilainya dijepit.
    expect(changed).toHaveBeenLastCalledWith(4);
    fireEvent.blur(input);
    expect(input).toHaveValue(4);
    fireEvent.change(input, { target: { value: '1' } });
    expect(changed).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('button', { name: 'Kurangi' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input).toHaveValue(1);
  });
});
