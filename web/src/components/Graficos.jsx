import { useEffect, useId, useRef, useState } from 'react';

// gráficos em SVG puro (sem biblioteca); as cores vêm do tokens.css

const LARGURA = 560; // largura padrão do desenho (o SVG escala com a tela)
const M = { t: 14, r: 10, b: 28, l: 38 };

// máximo do eixo com 4 intervalos de passo "redondo" (1, 2, 2,5, 5, 10...)
function maximoBonito(v) {
  if (v <= 0) return 4;
  const bruto = v / 4;
  const exp = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / exp;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  return passo * 4;
}

const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;

// mede o contêiner: o desenho tem sempre a largura real, então o texto não encolhe no celular
function useLargura(inicial) {
  const ref = useRef(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(260, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura];
}

function Eixos({ L, H, max, rotulos, passo, ticks }) {
  const h = H - M.t - M.b;
  return (
    <g className="g-eixo">
      {[0, 1, 2, 3, 4].map((i) => {
        const t = i / 4;
        const y = M.t + h - h * t;
        return (
          <g key={i}>
            <line x1={M.l} x2={L - M.r} y1={y} y2={y} className="g-grade" />
            <text x={M.l - 6} y={y + 4} textAnchor="end">{fmt(max * t)}</text>
          </g>
        );
      })}
      {rotulos.map((r, i) =>
        i % passo === 0 ? (
          <text key={i} x={r.x} y={H - 8} textAnchor="middle">{r.texto}</text>
        ) : null
      )}
    </g>
  );
}

// colunas agrupadas; as marcadas como "previsto" ficam claras e tracejadas
export function Colunas({ itens, series, altura = 220, rotulo, unidade = 'peças' }) {
  const [ref, L] = useLargura(LARGURA);
  const H = altura;
  const h = H - M.t - M.b;
  const max = maximoBonito(Math.max(...itens.flatMap((i) => i.valores), 0));
  const w = (L - M.l - M.r) / itens.length;
  const bw = Math.min(26, (w * 0.78) / series.length);
  const rotulos = itens.map((it, i) => ({ x: M.l + w * i + w / 2, texto: dm(it.dia) }));

  return (
    <div ref={ref}>
    <svg className="grafico-svg" width="100%" height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={rotulo}>
      <Eixos L={L} H={H} max={max} rotulos={rotulos} passo={Math.ceil(itens.length / Math.max(3, Math.floor(L / 62)))} />
      {itens.map((it, i) =>
        it.valores.map((v, s) => {
          const bh = (v / max) * h;
          const x = M.l + w * i + (w - bw * series.length) / 2 + bw * s;
          return (
            <rect
              key={`${i}-${s}`}
              x={x + 1}
              y={M.t + h - bh}
              width={bw - 2}
              height={Math.max(bh, v > 0 ? 2 : 0)}
              rx="3"
              className={it.previsto ? 'g-previsto' : undefined}
              style={{ fill: series[s].cor, stroke: it.previsto ? series[s].cor : 'none' }}
            >
              <title>{`${dm(it.dia)}${it.previsto ? ' (previsto)' : ''}: ${fmt(v)} ${unidade} (${series[s].nome})`}</title>
            </rect>
          );
        })
      )}
    </svg>
    </div>
  );
}

/** Linha com área e uma linha tracejada de referência (média). pontos: [{ dia, valor }] */
export function Linha({ pontos, cor = 'var(--ciano)', media, altura = 220, rotulo, unidade = 'peças' }) {
  const [ref, L] = useLargura(LARGURA);
  const gradienteId = useId();
  if (!pontos.length) return <div ref={ref} className="vazio">Nenhuma contagem disponível neste período.</div>;
  const H = altura;
  const h = H - M.t - M.b;
  const max = maximoBonito(Math.max(...pontos.map((p) => p.valor), media ?? 0, 0));
  const passoX = (L - M.l - M.r) / Math.max(1, pontos.length - 1);
  const xy = pontos.map((p, i) => [M.l + passoX * i, M.t + h - (p.valor / max) * h]);
  const linha = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${linha} L${xy[xy.length - 1][0].toFixed(1)} ${M.t + h} L${xy[0][0].toFixed(1)} ${M.t + h} Z`;
  const rotulos = pontos.map((p, i) => ({ x: xy[i][0], texto: dm(p.dia) }));
  const yMedia = media != null ? M.t + h - (media / max) * h : null;

  return (
    <div ref={ref}>
    <svg className="grafico-svg" width="100%" height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={rotulo}>
      <defs>
        <linearGradient id={gradienteId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00e5ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#00e5ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Eixos L={L} H={H} max={max} rotulos={rotulos} passo={Math.ceil(pontos.length / Math.max(3, Math.floor(L / 62)))} />
      <path d={area} fill={`url(#${gradienteId})`} />
      {yMedia != null && (
        <g>
          <line x1={M.l} x2={L - M.r} y1={yMedia} y2={yMedia} className="g-media" />
          <text x={L - M.r} y={yMedia - 5} textAnchor="end" className="g-media-texto">média {fmt(media)}</text>
        </g>
      )}
      <path d={linha} fill="none" stroke={cor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" fill="var(--bg)" stroke={cor} strokeWidth="2">
          <title>{`${dm(pontos[i].dia)}: ${fmt(pontos[i].valor)} ${unidade}`}</title>
        </circle>
      ))}
    </svg>
    </div>
  );
}

const PALETA = ['var(--ciano)', 'var(--verde)', 'var(--azul)', 'var(--alerta)', '#c792ea', '#ff8a8a'];

/** Rosca com legenda. fatias: [{ nome, valor }] */
export function Rosca({ fatias, centro, rotulo }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="rosca">
      <svg viewBox="0 0 140 140" className="rosca-svg" role="img" aria-label={rotulo}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--borda)" strokeWidth="16" opacity="0.5" />
        {total > 0 &&
          fatias.map((f, i) => {
            const comp = (f.valor / total) * C;
            const el = (
              <circle
                key={f.nome}
                cx="70" cy="70" r={R} fill="none"
                stroke={PALETA[i % PALETA.length]} strokeWidth="16"
                strokeDasharray={`${Math.max(comp - 1.5, 0)} ${C}`}
                strokeDashoffset={-acumulado}
                transform="rotate(-90 70 70)"
              >
                <title>{`${f.nome}: ${fmt(f.valor)} (${fmt((f.valor / total) * 100)}%)`}</title>
              </circle>
            );
            acumulado += comp;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" className="rosca-num">{fmt(total)}</text>
        <text x="70" y="86" textAnchor="middle" className="rosca-leg">{centro}</text>
      </svg>
      <ul className="rosca-legenda">
        {fatias.map((f, i) => (
          <li key={f.nome}>
            <i style={{ background: PALETA[i % PALETA.length] }} />
            <span>{f.nome}</span>
            <b>{fmt(f.valor)}</b>
            <small>{total ? `${fmt((f.valor / total) * 100)}%` : '0%'}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
