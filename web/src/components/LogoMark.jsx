// parafuso com rosca: marca do projeto (mesmo desenho do favicon)
export default function LogoMark() {
  return (
    <svg className="logo-marca" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="pf-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f2747" />
          <stop offset="1" stopColor="#0a1628" />
        </linearGradient>
        <linearGradient id="pf-parafuso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00e5ff" />
          <stop offset="1" stopColor="#1fc99a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#pf-fundo)" />
      <g transform="rotate(40 32 32)" fill="none" stroke="url(#pf-parafuso)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 15Q17 8 24 8H40Q47 8 47 15V17H17Z" />
        <path d="M26 17L24.5 21L27 24L24.5 28L27 31L24.5 35L27 38L24.5 42L27 45L32 56L37 45L39.5 42L37 38L39.5 35L37 31L39.5 28L37 24L39.5 21L38 17" />
      </g>
    </svg>
  );
}
