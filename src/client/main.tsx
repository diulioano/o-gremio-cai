import './styles/tokens.css';
import './styles/global.css';
import './styles/animations.css';
import { render } from 'preact';
import { isTeamSlug } from '../shared/teams';
import { HomePage } from './components/home/HomePage';
import { TeamPage } from './components/team/TeamPage';

// vaicair.diuliano.com/ lista os times; vaicair.diuliano.com/inter etc. é a página de um time.
// O Worker escolhe o time pelo caminho e marca <html data-team>.
const slug = document.documentElement.dataset.team;
const app = document.getElementById('app');
if (app) render(isTeamSlug(slug) ? <TeamPage slug={slug} /> : <HomePage />, app);
