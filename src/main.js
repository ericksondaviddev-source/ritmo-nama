import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });
// El catálogo se importa y monta tras el primer pintado: no pesa en el bundle
// inicial ni retrasa el FCP
const mountCatalogDeferred = () =>
  import('./components/catalog.js').then(({ mountCatalog }) => mountCatalog(document.getElementById('catalogo')));
if ('requestIdleCallback' in window) {
  requestIdleCallback(mountCatalogDeferred, { timeout: 500 });
} else {
  setTimeout(mountCatalogDeferred, 32);
}

document.documentElement.dataset.ready = 'true';
