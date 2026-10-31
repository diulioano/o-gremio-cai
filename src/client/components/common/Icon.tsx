// Ícones desenhados (setas e símbolos Unicode viram emoji no iOS).
const ICONS = {
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  warn: 'M12 3L2 21h20L12 3zM12 10v5M12 18v.01',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  bars: 'M5 20V11M12 20V4M19 20v-6',
  bang: 'M12 6v8M12 18.5v.01',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
} as const;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = '1em', strokeWidth = 2.4 }: Props) {
  return (
    <svg
      class="ico"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
