import { useEffect, useRef } from 'preact/hooks';
import type { Team } from '../../../shared/teams';
import type { Share } from '../../hooks/useShare';
import { cx } from '../../lib/cx';
import { Icon } from '../common/Icon';
import s from './ShareSheet.module.css';

interface Props {
  share: Share;
  team: Team;
  sim: boolean;
  mobile: boolean;
}

/** Prévia do card: folha que sobe no celular, janela no PC. */
export function ShareSheet({ share: sh, team, sim, mobile }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = sh.state !== 'closed';
  const of = `d${team.art.toLowerCase()} ${team.name}`;
  const error = sh.state === 'error',
    loading = sh.state === 'loading';

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const text = error
    ? `Não deu para gerar a imagem agora. Mande o link da página ${of}.`
    : sim
      ? `Baixe a imagem e mande no grupo. O link abre a página ${of} com a tabela real; seus palpites vão só na imagem.`
      : `Baixe a imagem e mande no grupo, ou copie o link da página ${of}.`;

  const preview = (
    <div class={s.preview} aria-busy={loading}>
      {sh.img && <img src={sh.img} alt={`Card: ${team.art} ${team.name} cai?`} class={s.img} />}
      {loading && (
        <div class={s.state}>
          <span class={s.spinner} aria-hidden="true"></span>
          <span class={s.muted}>Gerando imagem…</span>
        </div>
      )}
      {error && (
        <div class={s.state} role="alert">
          <span class={s.warn} aria-hidden="true">
            <Icon name="warn" size="22px" />
          </span>
          <strong>Não deu para gerar a imagem</strong>
          {mobile && <span class={s.muted}>Mande o link da página {of}.</span>}
        </div>
      )}
    </div>
  );

  const copyBtn = (cls: string | undefined, label = 'Copiar link') => (
    <button class={cls} onClick={() => void sh.copy()}>
      {sh.copied ? (
        <>
          <Icon name="check" size="18px" /> Link copiado
        </>
      ) : (
        label
      )}
    </button>
  );

  const actions = error ? (
    <>
      {copyBtn(s.primary)}
      {mobile && <span class={s.url}>{sh.link.replace(/^https?:\/\//, '')}</span>}
    </>
  ) : mobile && sh.canShareFiles ? (
    <>
      <button class={s.primary} disabled={loading} onClick={() => void sh.share()}>
        <Icon name="share" size="20px" /> Compartilhar
      </button>
      <button class={s.secondary} disabled={loading} onClick={sh.download}>
        Baixar imagem
      </button>
    </>
  ) : (
    <>
      <button class={s.primary} disabled={loading} onClick={sh.download}>
        <Icon name="download" size="20px" /> Baixar imagem
      </button>
      {mobile && copyBtn(s.secondary)}
    </>
  );

  const close = (
    <button class={s.close} aria-label="Fechar" onClick={sh.close}>
      <Icon name="close" size="18px" />
    </button>
  );

  return (
    <dialog
      ref={ref}
      class={cx(s.dialog, mobile ? s.sheet : s.modal)}
      aria-labelledby="share-title"
      onCancel={(e) => {
        e.preventDefault();
        sh.close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) sh.close();
      }}
    >
      {open && (
        <div class={s.panel}>
          {mobile ? (
            <>
              <span class={s.grip} aria-hidden="true"></span>
              <div class={s.head}>
                <h2 id="share-title" class={s.title}>
                  Compartilhar
                </h2>
                {close}
              </div>
              {preview}
              <div class={s.actions}>{actions}</div>
            </>
          ) : (
            <>
              {preview}
              <div class={s.side}>
                <div class={s.head}>
                  <h2 id="share-title" class={s.title}>
                    {sim ? 'Compartilhar sua simulação' : 'Compartilhar'}
                  </h2>
                  {close}
                </div>
                <p class={s.text}>{text}</p>
                <div class={s.field}>
                  <span class={s.fieldUrl}>{sh.link.replace(/^https?:\/\//, '')}</span>
                  <button class={s.fieldBtn} onClick={() => void sh.copy()}>
                    {sh.copied ? (
                      <>
                        <Icon name="check" size="16px" /> Copiado
                      </>
                    ) : (
                      'Copiar'
                    )}
                  </button>
                </div>
                <div class={s.actions}>{actions}</div>
              </div>
              {sh.copied && (
                <div class={s.toast} role="status">
                  <Icon name="check" size="18px" /> Link copiado
                </div>
              )}
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
