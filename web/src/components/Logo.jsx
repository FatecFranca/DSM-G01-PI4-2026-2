import LogoMark from './LogoMark.jsx';

// marca e nome (PARA em ciano, FLOW em verde); usar dentro de um elemento com className="logo"
export default function Logo() {
  return (
    <>
      <LogoMark />
      <span className="para">PARA</span>
      <span className="flow">FLOW</span>
    </>
  );
}
