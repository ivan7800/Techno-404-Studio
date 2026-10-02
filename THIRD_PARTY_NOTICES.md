# THIRD PARTY NOTICES — Techno 404 Studio v4.2.0

Techno 404 Studio no incluye estos codecs dentro del ZIP. Se cargan bajo demanda desde URLs fijadas por versión y el navegador intenta conservarlos en Cache Storage para reutilización offline.

## lamejs 1.2.1 / LAME

- Uso: codificación MP3 en el navegador.
- Paquete: `lamejs@1.2.1`.
- Licencia declarada por el paquete: LGPL-3.0.
- Proyecto: https://github.com/zhuker/lamejs
- LAME: https://lame.sourceforge.io/
- URL fijada utilizada por la app: `https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js`

El proyecto Techno 404 no modifica el código de lamejs; lo carga como componente separado.

## libflacjs 5.6.0 / libFLAC

- Uso: codificación FLAC lossless en el navegador.
- Paquete: `libflacjs@5.6.0`.
- Wrapper libflac.js: MIT.
- libFLAC de referencia: licencia BSD.
- Proyecto: https://github.com/mmig/libflac.js
- URL fijada utilizada por la app: `https://cdn.jsdelivr.net/npm/libflacjs@5.6.0/dist/libflac.js`

## Privacidad

La aplicación descarga únicamente el código de los codecs. El audio renderizado no se envía a jsDelivr ni a ningún servicio externo: se procesa localmente en el navegador.
