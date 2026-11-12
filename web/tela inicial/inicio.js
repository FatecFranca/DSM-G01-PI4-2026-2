(function () {
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => n.toLocaleString('pt-BR');

  /* ---------- Topo ganha borda ao rolar ---------- */
  const topo = document.getElementById('topo');
  const aoRolar = () => topo.classList.toggle('rolou', window.scrollY > 8);
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  /* ---------- Conversa do mascote (mensagens uma a uma) ---------- */
  const conversa = document.getElementById('conversa');

  if (conversa) {
    const baloes = [...conversa.querySelectorAll('.balao')];

    if (reduzido) {
      baloes.forEach((b) => b.classList.add('visivel'));
    } else {
      const digitando = document.createElement('p');
      digitando.className = 'balao digitando visivel';
      digitando.setAttribute('aria-hidden', 'true');
      digitando.innerHTML = '<span></span><span></span><span></span>';

      let i = 0;

      const proximo = () => {
        if (i >= baloes.length) return;
        const balao = baloes[i];

        conversa.insertBefore(digitando, balao);

        // mensagens maiores "demoram" um pouco mais para digitar
        const espera = Math.min(1800, 600 + balao.textContent.trim().length * 9);

        setTimeout(() => {
          digitando.remove();
          balao.classList.add('visivel');
          i++;
          setTimeout(proximo, 350);
        }, espera);
      };

      setTimeout(proximo, 500);
    }
  }

  /* ---------- Elementos aparecem ao rolar ---------- */
  const alvos = document.querySelectorAll('.revelar');

  if ('IntersectionObserver' in window && !reduzido) {
    alvos.forEach((el) => {
      const irmaos = [...el.parentElement.children].filter((c) => c.classList.contains('revelar'));
      el.style.setProperty('--atraso', irmaos.indexOf(el) * 90 + 'ms');
    });

    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visivel');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    alvos.forEach((el) => obs.observe(el));
  } else {
    alvos.forEach((el) => el.classList.add('visivel'));
  }

  /* ---------- Dashboard de exemplo (valores ilustrativos) ---------- */
  const LIMITE_BAIXO = 150;

  const linhas = [...document.querySelectorAll('#estoque li')].map((li) => ({
    li,
    qtd: Number(li.dataset.qtd),
    max: Number(li.dataset.max),
    atual: 0,
    barra: li.querySelector('.barra i'),
    saida: li.querySelector('.qtd'),
  }));
  const totalEl = document.getElementById('total');

  function renderizar() {
    let total = 0;
    linhas.forEach((l) => {
      const valor = Math.round(l.atual);
      total += valor;
      l.saida.textContent = fmt(valor);
      l.barra.style.width = Math.min(100, (l.atual / l.max) * 100) + '%';
      l.li.classList.toggle('baixo', l.qtd < LIMITE_BAIXO);
    });
    totalEl.textContent = fmt(total);
  }

  function simularEntradas() {
    if (reduzido) return;
    setInterval(() => {
      if (document.hidden) return;
      const ativos = linhas.filter((l) => l.qtd >= LIMITE_BAIXO && l.qtd < l.max);
      if (!ativos.length) return;

      const l = ativos[Math.floor(Math.random() * ativos.length)];
      l.qtd = Math.min(l.max, l.qtd + 1 + Math.floor(Math.random() * 3));
      l.atual = l.qtd;
      renderizar();

      l.li.classList.remove('pulsa');
      void l.li.offsetWidth; // reinicia a animação
      l.li.classList.add('pulsa');
    }, 2200);
  }

  function contarAteOValor() {
    if (reduzido) {
      linhas.forEach((l) => (l.atual = l.qtd));
      renderizar();
      return;
    }
    const duracao = 1200;
    const inicio = performance.now();

    (function passo(agora) {
      const p = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 3);
      linhas.forEach((l) => (l.atual = l.qtd * suave));
      renderizar();
      if (p < 1) requestAnimationFrame(passo);
      else simularEntradas();
    })(inicio);
  }

  // o painel só começa a contar quando aparece na tela
  const painel = document.querySelector('.painel');
  if (linhas.length && painel) {
    if ('IntersectionObserver' in window) {
      const obsPainel = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) {
            obsPainel.disconnect();
            contarAteOValor();
          }
        },
        { threshold: 0.3 }
      );
      obsPainel.observe(painel);
    } else {
      contarAteOValor();
    }
  }

  /* ---------- Destaque que percorre os passos da IoT ---------- */
  const passos = [...document.querySelectorAll('.passos li')];
  if (passos.length && !reduzido) {
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      passos.forEach((p, k) => p.classList.toggle('ativo', k === i));
      i = (i + 1) % passos.length;
    }, 1400);
  }
})();