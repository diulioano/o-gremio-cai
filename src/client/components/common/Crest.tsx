import type { TeamInfo } from '../../../domain/standings';
import { hideImg } from '../../lib/hideImg';
import s from './Crest.module.css';

interface Props {
  team: TeamInfo;
  size: string;
}

/** Escudo da API; sem escudo (ou se a imagem falhar), a sigla num círculo. */
export function Crest({ team, size }: Props) {
  return (
    <span class={s.crest} style={{ width: size, height: size }}>
      <span class={s.code} style={{ display: team.crest ? 'none' : 'grid' }}>
        {team.code}
      </span>
      {team.crest && <img class={s.img} src={team.crest} alt="" loading="lazy" onError={hideImg} />}
    </span>
  );
}
