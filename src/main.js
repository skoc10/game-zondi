import { Game } from './core/Game.js';

const game = new Game(document.getElementById('game'));
// Hata ayıklama ve otomatik testler için
window.__game = game;
