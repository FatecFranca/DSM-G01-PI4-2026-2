import { useState } from 'react';

export default function CampoSenha({ id, valor, aoMudar, aoSair, autoComplete, classe = '', descrito }) {
  const [mostrando, setMostrando] = useState(false);

  return (
    <div className="senha-wrap">
      <input
        id={id}
        type={mostrando ? 'text' : 'password'}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={aoSair}
        autoComplete={autoComplete}
        aria-describedby={descrito}
        className={classe}
        required
      />
      <button
        type="button"
        className="toggle"
        aria-pressed={mostrando}
        aria-label={mostrando ? 'Ocultar senha' : 'Mostrar senha'}
        onClick={() => setMostrando((m) => !m)}
      >
        <svg className="olho" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {mostrando ? (
            <>
              <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <>
              <path d="M10.73 5.08A10.74 10.74 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" />
              <path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" />
              <path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" />
              <path d="m2 2 20 20" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
