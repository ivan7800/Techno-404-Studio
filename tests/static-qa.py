from pathlib import Path
import json, re, struct, sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
html=(ROOT/'index.html').read_text(encoding='utf-8')
ids=re.findall(r'\bid=["\']([^"\']+)',html)
if len(ids)!=len(set(ids)): errors.append('IDs HTML duplicados')
idset=set(ids)
refs=[]
for f in (ROOT/'js').glob('*.js'):
    t=f.read_text(encoding='utf-8')
    for pat in (r'\$\(["\']#([^"\']+)',r'getElementById\(["\']([^"\']+)'):
        refs += [(f.name,m.group(1)) for m in re.finditer(pat,t)]
missing=sorted(set(x[1] for x in refs)-idset)
if missing: errors.append('IDs referenciados ausentes: '+', '.join(missing))
manifest=json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
for icon in manifest.get('icons',[]):
    if not (ROOT/icon['src']).is_file(): errors.append('Icono ausente: '+icon['src'])
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
m=re.search(r'const FILES=\[(.*?)\];',sw,re.S)
if not m: errors.append('No se pudo leer FILES del Service Worker')
else:
    entries=re.findall(r"'([^']+)'",m.group(1))
    for e in entries:
        if e=='./': continue
        rel=e[2:] if e.startswith('./') else e
        if not (ROOT/rel).is_file(): errors.append('Precache ausente: '+e)
# User-controlled names must no longer be injected through innerHTML in v4 UI.
v4=(ROOT/'js/v4-ui.js').read_text(encoding='utf-8')
if re.search(r'innerHTML\s*=.*(?:row\.name|pad\.fileName|pad\.name)',v4): errors.append('innerHTML inseguro con nombre de sample/pad')
# CLEAR PATTERN wiring must use the empty factory.
app=(ROOT/'js/app.js').read_text(encoding='utf-8')
if "clearPatternBtn').onclick" not in app or 'T.makeEmptyPattern()' not in app: errors.append('CLEAR PATTERN no usa makeEmptyPattern')
# Version coherence.
for f in ['index.html','sw.js','ABRIR_TECHNO_404.bat']:
    if '4.1.0' in (ROOT/f).read_text(encoding='utf-8'): errors.append(f'Versión antigua en {f}')
if errors:
    print('FAIL static-qa')
    for e in errors: print('-',e)
    sys.exit(1)
print(f'PASS static-qa: {len(ids)} IDs únicos, {len(set(x[1] for x in refs))} referencias DOM, manifest/SW/seguridad estática OK')
