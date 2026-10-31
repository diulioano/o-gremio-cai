/** Imagem quebrada: esconde e mostra o primeiro irmão (a sigla do time no lugar do escudo). */
export function hideImg(e: Event): void {
  const i = e.currentTarget as HTMLImageElement;
  i.style.display = 'none';
  const sp = i.parentNode && (i.parentNode as Element).firstElementChild;
  if (sp && sp !== i) (sp as HTMLElement).style.display = 'grid';
}
