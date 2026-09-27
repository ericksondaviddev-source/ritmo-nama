import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { mountCatalog } from './components/catalog.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });
mountCatalog(document.getElementById('catalogo'));

document.documentElement.dataset.ready = 'true';
