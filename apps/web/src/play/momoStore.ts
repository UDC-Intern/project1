import type { MomoColor, MomoLook } from '@udakids/engine';
import { create } from 'zustand';

/** Tampilan Momo milik anak yang sedang bermain; dibagi ke semua halaman area anak. */
type MomoState = {
  color: MomoColor | null;
  look: MomoLook | null;
  set: (color: MomoColor, look: MomoLook | null) => void;
};

export const useOwnMomo = create<MomoState>((set) => ({
  color: null,
  look: null,
  set: (color, look) => set({ color, look }),
}));
