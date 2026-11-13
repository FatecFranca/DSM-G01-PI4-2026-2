import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Icone from '../components/Icone.jsx';
import Revelar from '../components/Revelar.jsx';
import '../styles/landing.css';

const FUNCOES = [
  ['separar', 'Separação automática', 'Separa fisicamente os parafusos por comprimento e por bitola.'],
  ['contar', 'Contagem de cada peça', 'Registra cada parafuso processado, sem contagem manual.'],
  ['painel', 'Dashboard em tempo real', 'Estoque atualizado a cada peça, no navegador e no celular.'],
  ['globo', 'Acompanhamento remoto', 'Consulte o estoque a qualquer momento, sem estar ao lado da máquina.'],
  ['raio', 'Alerta de estoque baixo', 'Aciona LED e buzzer automaticamente com base em uma regra de negócio.'],
  ['ajustes', 'Controle remoto', 'Ligue e desligue o separador de qualquer lugar, pelo dashboard.'],
];

const PROBLEMAS = [
  ['relogio', 'Processo lento', 'Classificar e contar por bitola e por comprimento, peça por peça, toma tempo da equipe.'],
  ['alerta', 'Sujeito a erro humano', 'A contagem feita à mão está sujeita a erros, e cada erro compromete o estoque que você acredita ter.'],
  ['arquivo', 'Sem registro digital', 'O processo não gera nenhum registro digital do estoque disponível.'],
];

const PASSOS = [
  ['regua', 'Sensores', 'Medem o comprimento e o peso de cada parafuso.'],
  ['chip', 'Microcontrolador', 'Processa os dados localmente (ESP32).'],
  ['enviar', 'MQTT', 'Envia cada peça em tempo real para o servidor.'],
  ['painel', 'Servidor Paraflow', 'Guarda o histórico e alimenta o dashboard web e o app.'],
];

const PUBLICO = [
  ['fabrica', 'Pequenas indústrias e oficinas mecânicas', 'Que compram e consomem parafusos de diferentes tamanhos e bitolas.'],
  ['caixa', 'Almoxarifados', 'Que precisam manter controle de estoque de itens de fixação.'],
  ['capelo', 'Estudantes e makers', 'Que querem automatizar processos simples de triagem de peças pequenas.'],
];

const DEMO = [
  ['M3 × 10 mm', 1240], ['M4 × 16 mm', 860], ['M5 × 20 mm', 430], ['M6 × 25 mm', 96],
];

export default function Landing() {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const f = () => setRolou(window.scrollY > 8);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  return (
    <>
      <header className={`topo${rolou ? ' rolou' : ''}`}>
        <div className="container topo-in">
          <a href="#inicio" className="logo logo-sm" aria-label="Paraflow, ir ao início"><Logo /></a>
          <nav className="menu" aria-label="Seções da página">
            <a href="#funcoes">Funções</a>
            <a href="#problema">Problema</a>
            <a href="#proposta">Proposta</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#publico">Para quem</a>
          </nav>
          <div className="topo-acoes">
            <Link to="/login" className="btn btn-solido btn-sm">Entrar</Link>
            <Link to="/cadastro" className="btn btn-contorno btn-sm">Cadastrar</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="container hero-in">
            <div>
              <span className="selo">IoT · MQTT · Tempo real</span>
              <h1 className="titulo">Parafusos contados e separados <span className="destaque">sem contagem manual</span></h1>
              <div className="conversa" aria-live="polite">
                <p className="balao">Oi! Eu sou o mascote do Paraflow. Deixa que eu explico o projeto em poucas palavras.</p>
                <p className="balao">Em oficinas, almoxarifados e pequenas indústrias, contar e classificar parafusos por bitola e por comprimento ainda é manual: lento, sujeito a erro humano e sem registro digital.</p>
                <p className="balao">O Paraflow separa os parafusos por comprimento e bitola, conta cada peça e mostra o estoque atualizado em tempo real no dashboard.</p>
              </div>
              <div className="hero-botoes">
                <a href="#funcoes" className="btn btn-solido">Ver as funções</a>
                <Link to="/cadastro" className="btn btn-contorno">Criar conta</Link>
              </div>
            </div>
            <div className="hero-mascote">
              <div className="mascote-brilho" aria-hidden="true" />
              <div className="mascote-flutua">
                <img src="/cat.png" width="800" height="800"
                     alt="Gato mascote do Paraflow fazendo joinha, com camiseta azul estampada com um parafuso" />
              </div>
            </div>
          </div>
        </section>

        <section className="secao" id="funcoes">
          <div className="container">
            <Revelar como="header" className="secao-titulo">
              <span className="sobretitulo">Funções</span>
              <h2 className="h2">O que o Paraflow faz por você</h2>
              <p className="lead">Do parafuso na bancada ao número no dashboard: separação, contagem e acompanhamento do estoque, tudo em um só sistema.</p>
            </Revelar>
            <div className="funcoes-layout">
              <div className="grade grade-funcoes">
                {FUNCOES.map(([i, t, d]) => (
                  <Revelar como="article" className="cartao" key={t}><Icone nome={i} /><h3>{t}</h3><p>{d}</p></Revelar>
                ))}
              </div>
              <Revelar como="figure" className="painel-demo" aria-label="Exemplo ilustrativo de dashboard">
                <figcaption className="topo-demo"><span>Estoque em tempo real</span><small>exemplo ilustrativo</small></figcaption>
                <ul className="demo-lista">
                  {DEMO.map(([nome, q]) => (
                    <li key={nome} className={q < 150 ? 'baixo' : ''}>
                      <span>{nome}</span>
                      <div className="barra"><i style={{ '--w': `${(q / 2000) * 100}%` }} /></div>
                      <b className="qtd">{q.toLocaleString('pt-BR')}</b>
                    </li>
                  ))}
                </ul>
              </Revelar>
            </div>
          </div>
        </section>

        <section className="secao secao-alt" id="problema">
          <div className="container">
            <Revelar como="header" className="secao-titulo">
              <span className="sobretitulo">O problema</span>
              <h2 className="h2">A contagem manual de parafusos ainda é a regra</h2>
              <p className="lead">Em oficinas, almoxarifados e pequenas indústrias, a contagem e a classificação de parafusos por bitola e por comprimento ainda são feitas manualmente.</p>
            </Revelar>
            <div className="grade grade-3">
              {PROBLEMAS.map(([i, t, d]) => (
                <Revelar como="article" className="cartao" key={t}><Icone nome={i} /><h3>{t}</h3><p>{d}</p></Revelar>
              ))}
            </div>
            <Revelar como="aside" className="destaque-aviso">
              <strong>O resultado prático:</strong> falta de visibilidade sobre quantas peças de cada tipo existem no momento. Quando uma bitola acaba sem aviso prévio, a produção atrasa.
            </Revelar>
          </div>
        </section>

        <section className="secao" id="proposta">
          <div className="container">
            <Revelar como="header" className="secao-titulo">
              <span className="sobretitulo">Nossa proposta</span>
              <h2 className="h2">Automatizar a separação, a contagem e o controle</h2>
              <p className="lead">Separar fisicamente os parafusos por comprimento e por bitola, contar cada peça processada e apresentar o estoque atualizado em tempo real, eliminando a contagem manual e reduzindo o erro humano.</p>
            </Revelar>
            <div className="comparativo">
              <Revelar como="article" className="coluna coluna-manual">
                <h3>Contagem manual</h3>
                <ul><li>Processo lento</li><li>Sujeito a erro humano</li><li>Sem registro digital do estoque</li><li>Sem visibilidade do que existe no momento</li></ul>
              </Revelar>
              <Revelar como="article" className="coluna coluna-paraflow">
                <h3>Com o Paraflow</h3>
                <ul><li>Separação automática por comprimento e bitola</li><li>Contagem de cada peça processada</li><li>Estoque atualizado em tempo real</li><li>Menos contagem manual e menos erro humano</li></ul>
              </Revelar>
            </div>
          </div>
        </section>

        <section className="secao secao-alt" id="como-funciona">
          <div className="container">
            <Revelar como="header" className="secao-titulo">
              <span className="sobretitulo">Como a IoT contribui</span>
              <h2 className="h2">Dos sensores ao dashboard, em tempo real</h2>
              <p className="lead">Os dados dos sensores são processados localmente pelo microcontrolador e enviados via MQTT ao servidor do Paraflow, que guarda o histórico e atualiza o dashboard.</p>
            </Revelar>
            <ol className="passos">
              {PASSOS.map(([i, t, d]) => (
                <Revelar como="li" key={t}><Icone nome={i} /><h3>{t}</h3><p>{d}</p></Revelar>
              ))}
            </ol>
          </div>
        </section>

        <section className="secao" id="publico">
          <div className="container">
            <Revelar como="header" className="secao-titulo">
              <span className="sobretitulo">Para quem</span>
              <h2 className="h2">Quem pode utilizar a solução</h2>
            </Revelar>
            <div className="grade grade-3">
              {PUBLICO.map(([i, t, d]) => (
                <Revelar como="article" className="cartao" key={t}><Icone nome={i} /><h3>{t}</h3><p>{d}</p></Revelar>
              ))}
            </div>
          </div>
        </section>

        <section className="secao secao-alt">
          <div className="container">
            <Revelar className="cta">
              <h2 className="h2">Saiba sempre quantos parafusos você tem</h2>
              <p>Crie sua conta e acompanhe o estoque por bitola e por comprimento, em tempo real.</p>
              <div className="hero-botoes centro">
                <Link to="/cadastro" className="btn btn-solido">Criar conta</Link>
                <Link to="/login" className="btn btn-contorno">Já tenho conta</Link>
              </div>
            </Revelar>
          </div>
        </section>
      </main>

      <footer className="rodape">
        <div className="container"><p>© 2026 Paraflow. Contagem e separação de parafusos com IoT.</p></div>
      </footer>
    </>
  );
}
