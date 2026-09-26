import './styles/main.css';
import { unlockAudioOnFirstGesture } from './core/audio/context.js';
import { mountHeader } from './components/header.js';

unlockAudioOnFirstGesture();
mountHeader(document.getElementById('site-header'));

document.documentElement.dataset.ready = 'true';
