interface Props {
  height: string;
  width?: string;
  radius?: string;
  background?: string;
  margin?: string;
  /** atraso da animação (ex.: '.2s') */
  delay?: string;
  /** sem animação (quando o carregamento já falhou) */
  still?: boolean;
}

/** Bloco cinza pulsando no lugar do conteúdo que ainda está carregando. */
export function Skeleton({
  height,
  width,
  radius = '10px',
  background = 'var(--surface)',
  margin,
  delay,
  still,
}: Props) {
  return (
    <div
      style={{
        width,
        height,
        margin,
        borderRadius: radius,
        background,
        animation: still ? 'none' : `shimmer 1.4s ease-in-out${delay ? ' ' + delay : ''} infinite`,
      }}
    ></div>
  );
}
