import s from './LoadFailed.module.css';

interface Props {
  msg: string;
  detail?: string;
}

/** Sem dados e sem cópia salva: avisa e deixa tentar de novo, em vez de carregar para sempre. */
export function LoadFailed({
  msg,
  detail = 'A conexão com a football-data.org falhou. Confira a internet e tente de novo.',
}: Props) {
  return (
    <div role="alert" class={s.box}>
      <p class={s.msg}>
        <strong class={s.strong}>{msg}</strong> {detail}
      </p>
      <button
        class={s.retry}
        onClick={() => {
          location.reload();
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}
