import { nivelDaSenha, requisitosSenha } from '../utils/validacao.js';

const NOMES = { fraca: 'fraca', media: 'média', forte: 'forte' };
const ROTULOS = { tamanho: '8+ caracteres', letra: 'Letra', numero: 'Número' };

export default function ForcaSenha({ senha }) {
  const nivel = nivelDaSenha(senha);
  return (
    <>
      <div className="forca" data-nivel={nivel}><div className="forca-barra" /></div>
      <span className="forca-texto">{nivel && `Força da senha: ${NOMES[nivel]}`}</span>
      <ul className="requisitos" aria-label="Requisitos da senha">
        {Object.entries(ROTULOS).map(([k, texto]) => (
          <li key={k} className={requisitosSenha[k](senha) ? 'ok' : ''}>{texto}</li>
        ))}
      </ul>
    </>
  );
}
