window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;
  T.Midi = {
    access: null,
    onNote: null,
    onCC: null,
    async init() {
      if (!navigator.requestMIDIAccess) throw new Error('Web MIDI no disponible en este navegador/contexto');
      this.access = await navigator.requestMIDIAccess();
      const bind = () => {
        for (const input of this.access.inputs.values()) {
          input.onmidimessage = e => {
            const [status, d1, d2] = e.data;
            const type = status & 0xf0;
            if (type === 0x90 && d2 > 0 && this.onNote) this.onNote(d1, d2);
            else if (type === 0xb0 && this.onCC) this.onCC(d1, d2);
          };
        }
      };
      bind();
      this.access.onstatechange = bind;
      return this.access.inputs.size;
    }
  };
})();
