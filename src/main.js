import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { mountCourse } from './components/course.js';
import { mountMidipad } from './components/midipad.js';
import { mountRenderStatus } from './components/render-status.js';
import { mountFaq } from './components/seo.js';
import { mountContact } from './components/contact.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { createMidipadAudio } from './core/audio/midipad.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

// Una sola fuente de verdad de la composición rítmica. Midipad la programa y el
// exportador de vídeo graba exactamente lo mismo; antes cada componente creaba la
// suya y el vídeo salía con el patrón de fábrica, no con lo editado.
const composition = createMidipadAudio({ engine, getContext: getAudioContext });

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });
mountCourse(document.getElementById('minicurso'), { engine });
mountMidipad(document.getElementById('midipad'), { engine, getContext: getAudioContext, audio: composition });
mountContact(document.getElementById('contacto'));
// FAQ visible + datos estructurados: el texto que ve el visitante es el mismo
// que declara el FAQPage, que es lo que Google exige.
mountFaq(document.getElementById('preguntas'));
// El indicador del render es fijo y va fuera de cualquier sección: si viviera en
// el editor, el visitante que se fuese a ver otra cosa lo perdería de vista y
// pensaría que el trabajo se había perdido.
mountRenderStatus();
// El catálogo se importa y monta tras el primer pintado: no pesa en el bundle
// inicial ni retrasa el FCP
const mountCatalogDeferred = () =>
  Promise.all([
    import('./components/catalog.js'),
    import('./components/editor.js')
  ]).then(([catalogo, editor]) => {
    catalogo.mountCatalog(document.getElementById('catalogo'));
    editor.mountEditor(document.getElementById('editor'));
  });
if ('requestIdleCallback' in window) {
  requestIdleCallback(mountCatalogDeferred, { timeout: 500 });
} else {
  setTimeout(mountCatalogDeferred, 32);
}

document.documentElement.dataset.ready = 'true';
