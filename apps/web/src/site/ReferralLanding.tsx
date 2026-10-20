import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../api/client';
import { rememberReferral } from './referral';
import '../parent/affiliate.css';

export function ReferralLanding() {
  const { code = '' } = useParams();
  const [preview, setPreview] = useState<{ valid: boolean; name?: string }>();
  useEffect(() => {
    let active = true;
    request<{ valid: boolean; name?: string }>(`/referral/${encodeURIComponent(code)}`)
      .then((data) => {
        if (!active) return;
        setPreview(data);
        if (data.valid) {
          rememberReferral(code);
          void request(`/referral/${encodeURIComponent(code)}/click`, { method: 'POST' }).catch(
            () => undefined,
          );
        }
      })
      .catch(() => active && setPreview({ valid: false }));
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <main className="referral-landing">
      <div className="referral-landing-card">
        <Link to="/">UdaKids</Link>
        <h1>Belajar bersama Momo</h1>
        {!preview ? (
          <p>Memeriksa tautan ajakan…</p>
        ) : preview.valid ? (
          <>
            <p>{preview.name} mengajak keluargamu bergabung dengan UdaKids.</p>
            <Link
              className="ui-btn ui-btn-primary"
              to={`/orang-tua/daftar?ref=${encodeURIComponent(code.toUpperCase())}`}
            >
              Daftar sekarang
            </Link>
          </>
        ) : (
          <>
            <p>Tautan ajakan ini tidak ditemukan.</p>
            <Link to="/">Kembali ke beranda</Link>
          </>
        )}
      </div>
    </main>
  );
}
