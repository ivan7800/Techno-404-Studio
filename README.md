# Techno 404 Studio v4.3.0

Groovebox / mini-DAW de música electrónica para navegador, construida con JavaScript y Web Audio API, sin frameworks. El núcleo funciona como aplicación estática y está preparado para GitHub Pages/PWA. Los codecs opcionales MP3/FLAC se descargan bajo demanda desde versiones fijadas y se cachean localmente para reutilización offline cuando el navegador lo permite.



## Novedad V4.3: motor multi-género

La V4.3 mantiene Techno como identidad principal, pero añade cinco modos musicales de primera clase sin duplicar la aplicación:

- **Techno** — 136 BPM base; estilos Hypnotic, Detroit, Minimal, Acid, Industrial, Hard Techno, Dub Techno y Peak Time.
- **Tech House** — 126 BPM base; Rolling, Groovy, Minimal y Percussive.
- **House** — 124 BPM base; Classic, Piano, Jackin y Vocal Groove.
- **Deep House** — 122 BPM base; Warm, Atmospheric, Soulful y Minimal Deep.
- **Acid House** — 126 BPM base; Chicago 303, Warehouse, Psychedelic y Jack Acid.

### Qué cambia al seleccionar un modo

- BPM y swing base.
- Perfil del mixer y master (sidechain, sends, drive, reverb, cutoff, compresión).
- Catálogo de estilos del generador.
- Reglas de batería, bajo, stabs/acordes, percusión y 303.
- Automatizaciones generadas.
- Construcción del Arranger: entrada progresiva de pistas y estructura base de 32 compases específica por género.

**APPLY MODE no borra los patterns.** Ajusta el perfil sonoro global. `GENERATE <GÉNERO>` sí reemplaza el pattern seleccionado, como ya ocurría con el generador Techno, y puede revertirse con Undo.

Los proyectos V4.x anteriores se migran automáticamente a `genre: techno` cuando no contienen información de género.

## Novedad V4.2: exportación multiformato profesional

V4.2 amplía el render offline manteniendo una única fuente de audio: primero se renderiza el proyecto/arreglo y después se codifica el mismo `AudioBuffer` al formato elegido.

### Formatos
- **WAV 16-bit PCM** — sin pérdidas y máxima compatibilidad de edición.
- **MP3 CBR** — 128 / 192 / 256 / **320 kbps**.
- **FLAC** — lossless con nivel de compresión 0–8.
- **STEMS WAV ZIP** — una pista por archivo, sin master global, como en V4.1.1.

### Opciones de exportación
- Normalización opcional a **-1 dBFS**.
- Fade-in y fade-out configurables.
- Cola de FX automática según delay/reverb o manual hasta 15 s.
- Nombre de archivo con proyecto, BPM y fecha.
- Indicador de progreso durante render y codificación.
- Botón **PREPARAR CODECS** para descargar/cachear MP3 y FLAC antes de trabajar sin conexión.

### Privacidad y funcionamiento offline
El audio del proyecto **no se sube a ningún servidor**. La codificación se realiza dentro del navegador. Para MP3/FLAC, la primera preparación necesita conexión si el codec todavía no está en caché. WAV y STEMS no dependen de codecs externos.

Los codecs están fijados a `lamejs 1.2.1` y `libflacjs 5.6.0`; consulta `THIRD_PARTY_NOTICES.md`.

## Novedad principal de V4.1: Premium UI + skins

V4.1 añade una capa visual completa sin cambiar el motor musical de V4:

### 7 skins
- **Carbon** — oscuro técnico, verde/azul.
- **Acid Lime** — verde ácido inspirado en hardware 303/909.
- **Detroit Amber** — negro/ámbar cálido.
- **Ultraviolet** — violeta/cian club.
- **Ice Blue** — azul frío de estudio.
- **Crimson** — rojo/ámbar industrial.
- **Studio Light** — tema claro profesional.

La skin se guarda en `localStorage`, por lo que se conserva entre sesiones. También puedes recorrer skins con **Shift+T** cuando el foco no está dentro de un campo de texto.

### Modos visuales
- **Cinematic** — máximo acabado: profundidad, brillo, blur y microinteracciones.
- **Clean** — misma jerarquía con menos efectos decorativos.
- **Performance** — elimina transiciones, blur y sombras costosas para priorizar rendimiento durante sesiones largas.

### Densidad
- **Normal**
- **Compact**

La apariencia se aplica también a automation lanes, waveform, analizador FFT, piano-roll, arranger, mixer, steps, botones y estados activos; no es un simple cambio del color de fondo.


## Correcciones de V4.1.1

- `CLEAR PATTERN` vacía realmente el patrón actual; ya no restaura accidentalmente el groove A1 de fábrica.
- Duplicar patrón busca primero un slot vacío y pide confirmación antes de sobrescribir datos.
- El render offline WAV se aproxima mejor al motor en vivo: respeta solo/mute en el mix, filtro HPF de canal, niveles de delay/reverb, kick click y sidechain por golpes realmente disparados.
- La cola de render se adapta a reverb/delay para reducir cortes de FX al final del WAV.
- Nombres de samples/pads se insertan como texto, no como HTML.
- Guardado local tolera Storage bloqueado/cuota agotada sin romper la interfaz.
- El Service Worker usa navegación network-first y actualiza recursos estáticos en segundo plano para reducir caché obsoleta.
- Se añadieron mejoras de accesibilidad para estado y canvases principales.
- El secuenciador móvil conserva correctamente la rejilla dinámica de 16/32/64 pasos sin forzar 16 columnas.

## Funciones musicales

- Step Sequencer de 16 / 32 / 64 pasos.
- 8 pistas: Kick, Clap, Closed HH, Open HH, Perc, Bass, Stab y Acid.
- Velocity, probability, ratchet, pitch, microtiming, gate, accent, glide y filter locks.
- 16 patterns A1–D4.
- Live Scenes con lanzamiento cuantizado.
- Motor multi-género: Techno, Tech House, House, Deep House y Acid House.
- Generadores contextuales por género con 24 estilos en total.
- Humanize y ritmos euclídeos.
- Acid piano roll.
- Clips MIDI editables para Bass / Stab / Acid.
- Arranger multipista hasta 64 compases con clips Pattern y MIDI.
- Drag & drop, resize, duplicate y zoom del arranger.
- Sampler por pista con waveform, trim, gain y reverse.
- 16 pads de sampler.
- Sample Browser local persistente con IndexedDB.
- Mixer por canal: volume, pan, LPF, EQ 3 bandas, delay/reverb sends, mute, solo y sidechain.
- Delay Bus y Reverb Bus dedicados.
- Compressor + limiter master.
- 2 LFOs para modulación.
- Automation Draw.
- Web MIDI.
- Teclado del PC como controlador.
- Analizador FFT.
- Guardado local y autosave.
- Import/export de proyecto JSON.
- Render MIX WAV / MP3 / FLAC.
- MP3 128/192/256/320 kbps.
- FLAC lossless con compresión 0–8.
- Normalización, fades y tail configurable.
- Export STEMS WAV ZIP.
- PWA / Service Worker / modo offline.

## Arranque recomendado

1. Descomprime el ZIP.
2. Ejecuta `ABRIR_TECHNO_404.bat`.
3. Se inicia un servidor local en `http://127.0.0.1:8040` y se abre el navegador.
4. Pulsa PLAY o cualquier control de audio para que el navegador autorice Web Audio.

Si Python no está disponible, el BAT intenta abrir `index.html` directamente. El servidor local es preferible para PWA, Service Worker y Web MIDI.

## Controles rápidos

- `Espacio`: Play Pattern.
- `A S D F G H J K`: disparo rápido de tracks.
- `Shift+T`: siguiente skin.
- Pads: `1 2 3 4 / Q W E R / Z X C V / 5 6 7 8`.

## Estructura

```text
Techno-404-Studio_V4.3.0/
├── index.html
├── ABRIR_TECHNO_404.bat
├── README.md
├── QA_REPORT.md
├── THIRD_PARTY_NOTICES.md
├── manifest.webmanifest
├── sw.js
├── icon-192.png
├── icon-512.png
├── css/
│   └── app.css
├── tests/
│   ├── logic-tests.js
│   └── static-qa.py
└── js/
    ├── state.js
    ├── genres.js
    ├── arranger.js
    ├── midi-clips.js
    ├── audio-engine.js
    ├── modulation.js
    ├── sequencer.js
    ├── generator.js
    ├── midi.js
    ├── storage.js
    ├── codecs.js
    ├── exporter.js
    ├── v4-ui.js
    ├── premium-ui.js
    └── app.js
```

## Filosofía de V4.x

La rama V4 prioriza profundidad y estabilidad sobre acumular funciones. V4.1 consolidó la experiencia visual, V4.2 añadió MP3/FLAC y V4.3 amplía la composición a cinco familias de música electrónica sin sustituir el motor musical ni introducir un backend.

Consulta `QA_REPORT.md` para las comprobaciones realizadas sobre esta entrega. La prueba final de MP3/FLAC debe hacerse al menos una vez en Chrome/Edge real con conexión para preparar los codecs y después repetirla offline.
