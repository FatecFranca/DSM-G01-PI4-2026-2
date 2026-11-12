import { useEffect, useRef, useState } from 'react';

/** Faz o bloco aparecer ao entrar na tela (respeita prefers-reduced-motion via CSS). */
export default function Revelar({ como: Tag = 'div', className = '', children, ...resto }) {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return setVisivel(true);
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisivel(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return <Tag ref={ref} className={`revelar${visivel ? ' visivel' : ''} ${className}`} {...resto}>{children}</Tag>;
}
