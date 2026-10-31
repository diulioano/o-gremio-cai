// Tipa o export default do Worker para os testes (exports.default.fetch em cloudflare:workers).
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import('./index');
  }
}
