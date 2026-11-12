(function () {
  const raiz = document.documentElement;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ao carregar: lê de que lado a página deve entrar
  try {
    const entrada = sessionStorage.getItem('transicao-entrada');
    if (entrada) {
      raiz.dataset.entrada = entrada;
      sessionStorage.removeItem('transicao-entrada');
    }
  } catch (e) {}

  // sentido: 'frente' (login -> cadastro) ou 'voltar' (cadastro -> login)
  window.navegarCom = function (url, sentido) {
    const card = document.querySelector('.card');
    if (reduzido || !card) {
      window.location.href = url;
      return;
    }
    try {
      sessionStorage.setItem('transicao-entrada', sentido === 'frente' ? 'direita' : 'esquerda');
    } catch (e) {}
    card.classList.add(sentido === 'frente' ? 'saindo-esquerda' : 'saindo-direita');
    setTimeout(() => { window.location.href = url; }, 280);
  };

  // Links com data-transicao usam a animação
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-transicao]');
    if (!link || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    window.navegarCom(link.href, link.dataset.transicao);
  });

  // Botão "voltar" do navegador: tira a classe de saída
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      document.querySelector('.card')?.classList.remove('saindo-esquerda', 'saindo-direita');
    }
  });
})();