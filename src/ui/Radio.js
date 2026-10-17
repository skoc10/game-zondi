// Altyazılı telsiz: mesajlar sırayla gösterilir, her birinden önce cızırtı çalar.
export class Radio {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('radio');
    this.fromEl = document.getElementById('radio-from');
    this.textEl = document.getElementById('radio-text');
    this.queue = [];
    this.current = null;
    this.timer = 0;
  }

  say(from, text, seconds = 5.5) {
    // Aynı mesaj kuyrukta zaten varsa ekleme
    if (this.queue.some((m) => m.text === text) || (this.current && this.current.text === text)) return;
    this.queue.push({ from, text, seconds });
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
    if (this.el) this.el.classList.add('hidden');
  }

  update(dt) {
    if (!this.el) return;
    if (this.current) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.current = null;
      this.el.classList.add('hidden');
    }
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    this.timer = next.seconds;
    this.fromEl.textContent = next.from;
    this.textEl.textContent = next.text;
    this.el.classList.remove('hidden');
    this.game.audio.play('radio');
  }
}
