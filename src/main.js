import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { mountCourse } from './components/course.js';
import { mountMidipad } from './components/midipad.js';
import { mountVideoExport } from './components/video-export.js';
import { mountContact } from './components/contact.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });
mountCourse(document.getElementById('minicurso'), { engine });
mountMidipad(document.getElementById('midipad'), { engine, getContext: getAudioContext });
mountVideoExport(document.getElementById('videoexport'), { engine, getContext: getAudioContext });
mountContact(document.getElementById('contacto'));
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
