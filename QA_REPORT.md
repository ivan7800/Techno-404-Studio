# QA REPORT — Techno 404 Studio v4.2.0

## Alcance

Ampliación de V4.1.1 a exportación multiformato sin alterar el motor musical principal. Se conserva WAV/STEMS y se añaden MP3/FLAC, normalización, fades, tail configurable, progreso y cacheo de codecs bajo demanda.

## Resultado

**PASS para sintaxis, QA estático, lógica automatizable, ensamblado de blobs de codecs mediante dobles deterministas y servidor HTTP local.**

La prueba de codificación con las implementaciones reales `lamejs` y `libflacjs` en Chrome/Edge queda **NO VERIFICADA** en este entorno porque el contenedor no dispone de una sesión de navegador/audio fiable ni de acceso DNS desde las herramientas locales. No se presenta esa prueba como superada.

## Cambios V4.2.0

1. **Export MIX multiformato**
   - WAV PCM 16-bit.
   - MP3 CBR 128/192/256/320 kbps.
   - FLAC lossless, compresión 0–8.
   - STEMS continúan en WAV ZIP.

2. **Un único render de origen**
   - El proyecto/arreglo se renderiza primero mediante `OfflineAudioContext`.
   - Después se aplica normalización/fades y se codifica al formato seleccionado.
   - WAV/MP3/FLAC no usan motores musicales diferentes.

3. **Postprocesado**
   - Normalización opcional a -1 dBFS.
   - Fade-in de 0–10 s.
   - Fade-out de 0–10 s.
   - Tail manual 0.25–15 s o automático con valor `0`.

4. **Nombres de salida**
   - Incluyen nombre de proyecto, BPM y fecha ISO.
   - Ejemplo: `Untitled_Techno_136bpm_2026-10-02.mp3`.

5. **Codecs bajo demanda**
   - MP3: `lamejs 1.2.1`.
   - FLAC: `libflacjs 5.6.0`.
   - URLs fijadas por versión.
   - `PREPARAR CODECS` intenta descargarlos y guardarlos en Cache Storage.
   - El Service Worker ya no elimina el cache de codecs al limpiar versiones antiguas del cache principal.
   - Si los codecs no están disponibles, WAV/STEMS siguen funcionando.

6. **Privacidad**
   - El audio no se sube a servicios externos.
   - Solo se descarga código de codec cuando se solicita MP3/FLAC por primera vez.

7. **UI de exportación**
   - Selector de formato.
   - Bitrate MP3.
   - Nivel de compresión FLAC.
   - Normalización, fades y tail.
   - Estado de codecs y progreso de render/codificación.

## Pruebas ejecutadas

### Sintaxis JavaScript

```bash
for f in js/*.js sw.js; do node --check "$f"; done
```

Resultado: **PASS**, sin errores de sintaxis.

### Tests de lógica

```bash
node tests/logic-tests.js
```

Resultado:

```text
PASS logic-tests: export multiformato + invariantes de patrones/generador
```

Incluye además de las pruebas de V4.1.1:
- normalización y fades dentro de rango;
- wrapper MP3 con encoder doble determinista;
- conversión Float32 → Int16;
- chunking MP3;
- ensamblado Blob `audio/mpeg`;
- wrapper FLAC con API doble determinista;
- PCM interleaved FLAC;
- ensamblado Blob `audio/flac`.

**Importante:** estos dobles verifican nuestra integración, no sustituyen una ejecución del codec real en navegador.

### QA estático DOM / PWA / seguridad

```bash
python3 tests/static-qa.py
```

Resultado:

```text
PASS static-qa: 153 IDs únicos, 141 referencias DOM, manifest/SW/seguridad estática OK
```

### Servidor HTTP local

```bash
python3 -m http.server 8040 --bind 127.0.0.1
```

Todos los recursos del precache del Service Worker se solicitaron por HTTP.

Resultado:

```text
PASS HTTP precache: 20/20 recursos -> 200
```

### CSS / manifest

- Llaves CSS: **259 / 259**.
- `manifest.webmanifest`: JSON válido.
- Cache principal: `techno404-v4.2.0`.
- `js/codecs.js` incluido en PWA precache.
- Cache de codecs separado: `techno404-codecs-v1`.

## Matriz de verificación

| Comprobación | Estado | Evidencia |
|---|---|---|
| Sintaxis JS | ✅ Verificado | `node --check` |
| IDs HTML únicos | ✅ Verificado | 153 IDs, 0 duplicados |
| Referencias DOM | ✅ Verificado | 141 referencias, 0 ausentes |
| Manifest/PWA core | ✅ Verificado | static QA + HTTP 20/20 |
| WAV | ✅ Verificado | firma RIFF/WAVE en tests |
| ZIP stems | ✅ Verificado | firma ZIP en tests |
| Normalización | ✅ Verificado | test automatizado |
| Fade-in / fade-out | ✅ Verificado | test automatizado |
| MP3 wrapper/chunking | ✅ Verificado | codec doble determinista |
| FLAC wrapper/interleaving | ✅ Verificado | codec doble determinista |
| Carga/cacheo de codecs | ⚠️ Verificado parcialmente | sintaxis y flujo revisados; CDN/cache real no ejecutado |
| MP3 real `lamejs` | ⏳ No ejecutado | requiere navegador + carga real del codec |
| FLAC real `libflacjs` | ⏳ No ejecutado | requiere navegador + carga real del codec |
| Reproducción auditiva MP3/FLAC | ⏳ No ejecutado | requiere navegador/salida de audio real |
| Export offline tras PREPARAR CODECS | ⏳ No ejecutado | requiere Cache Storage real + desconexión |
| Audio Web Audio real | ⏳ No ejecutado | requiere Chrome/Edge interactivo |
| Web MIDI físico | ⏳ No ejecutado | requiere dispositivo MIDI |
| Instalación PWA en dispositivo | ⏳ No ejecutado | requiere HTTPS/dispositivo real |
| Lighthouse | ⏳ No ejecutado | no se inventa puntuación |

## Prueba manual final recomendada

1. Abrir con `ABRIR_TECHNO_404.bat`.
2. Pulsar **PREPARAR CODECS** con conexión.
3. Confirmar estado `MP3 ✓ FLAC ✓`.
4. Crear un patrón breve reconocible.
5. Exportar WAV.
6. Exportar MP3 128, 192, 256 y 320 kbps.
7. Exportar FLAC nivel 5.
8. Reproducir todos los archivos y comparar inicio/final/FX con el WAV.
9. Activar normalización y verificar que no aparece clipping audible.
10. Probar fade-in/fade-out.
11. Probar `TAIL 0` con delay/reverb altos.
12. Desconectar la red, recargar y volver a exportar MP3/FLAC para confirmar cache offline.
13. Publicar bajo GitHub Pages y repetir la prueba desde HTTPS.

## Limitaciones reales

- La primera preparación de MP3/FLAC requiere red si el navegador no tiene esos codecs cacheados.
- El cache HTTP del navegador/Cache Storage puede ser eliminado manualmente por el usuario o por políticas de almacenamiento.
- No se verificó en este entorno la ejecución real de los dos codecs externos.
- Exportaciones largas continúan usando memoria proporcional a la duración porque `OfflineAudioContext` genera primero el mix completo.
- STEMS se mantienen en WAV; no se añadieron stems MP3/FLAC para evitar multiplicar tiempo y memoria de codificación sin una necesidad clara.
