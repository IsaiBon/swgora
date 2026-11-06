import pypdf
import re
import json

reader = pypdf.PdfReader('RecursosExtras/MRK.pdf')

PREFIX_BRANDS = {
    'MGT': ('Toyota', 'Japón'),
    'MGH': ('Hino', 'Japón'),
    'MGN': ('Nissan', 'Japón'),
    'MGS': ('Suzuki', 'Japón'),
    'MGM': ('Mitsubishi', 'Japón'),
    'MGZ': ('Mazda', 'Japón'),
    'MGI': ('Isuzu', 'Japón'),
    'MGK': ('Komatsu', 'Japón'),
    'MGD': ('Daihatsu', 'Japón'),
    'MGO': ('Honda', 'Japón'),
    'MGB': ('Subaru', 'Japón'),
    'MGY': ('Universal', 'Japón')
}

# Regex to detect OEM codes at the end of the line
OEM_PATTERNS = [
    r'\b\d{5}-\d{5}\b',               # Toyota / Daihatsu 11122-15020
    r'\b\d{5}-[A-Z0-9]{5}\b',         # Nissan 13212-01B01
    r'\b\d{5}-[A-Z0-9]{3,4}\b',       # Nissan 13211-J6500
    r'\b\d{5}-\d{4}\b',               # Hino 11122-1120
    r'\b\d-\d{5}-\d{3}-\d\b',         # Isuzu 1-11721-001-0
    r'\b\d-\d{5}-\d{3}-[A-Z0-9/]+\b', # Isuzu 5-11721-015-0/-1
    r'\bMD\d{6}\b',                   # Mitsubishi MD000461
    r'\bME\d{6}\b',                   # Mitsubishi ME201054
    r'\b\d{4}-\d{2}-\d{3}\b',         # Mazda 0249-10-130
    r'\b[A-Z0-9]{4}-\d{2}-\d{3}\b',   # Mazda Z5Y1-10-280
    r'\b\d{5}-[A-Z0-9]{3}-\d{3}\b',   # Honda 12204-689-300
    r'\b\d{5}-[A-Z0-9]{3}-\d{3}[A-Z]?\b', # Honda 12205-PE0-305
    r'\b\d{4}-\d{2}-\d{4}\b',         # Komatsu 6221-19-1311
    r'\b\d{5}-\d{4}\b',               # Subaru 38091-2100
]

combined_oem_regex = re.compile('|'.join(OEM_PATTERNS), re.IGNORECASE)

records = []
for p_idx, page in enumerate(reader.pages):
    text = page.extract_text()
    for line in text.split('\n'):
        line = line.strip()
        if not line or any(h in line for h in ['MRK No', 'Boundary', '(mm)', 'Engine model', 'Parts No.', 'New No.']):
            continue
            
        m = re.match(r'^(MG[A-Z0-9-]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(.*)$', line)
        if not m:
            continue
            
        code = m.group(1).strip()
        outer = float(m.group(2))
        inner = float(m.group(3))
        length = float(m.group(4))
        rest = m.group(5).strip()
        
        pfx = code[:3]
        brand, origin = PREFIX_BRANDS.get(pfx, ('Universal', 'Japón'))
        
        # Extract OEM references from rest
        oem_refs = []
        for oem_m in combined_oem_regex.finditer(rest):
            oem_refs.append(oem_m.group(0).strip())
            
        # Remove OEM references to get engines
        engine_part = combined_oem_regex.sub('', rest).strip()
        # Clean engine text
        engine_part = re.sub(r'[,/\s]+$', '', engine_part).strip()
        
        # Extract individual clean engine tokens if available
        engines = []
        if engine_part:
            # Clean common words like 4VALVES, NEW, OLD, PICK UP, etc.
            tokens = re.split(r'[,/]+', engine_part)
            for t in tokens:
                t = t.strip()
                if t and not any(skip == t.upper() for skip in ['4VALVES', '4 VALVES', 'VSLVES', 'OLD', 'NEW', 'ENG', 'ENG.', 'CAT.', 'PICK UP']):
                    engines.append(t)
                    
        records.append({
            'codigo_mrk': code,
            'diametro_exterior_mm': outer,
            'diametro_interior_mm': inner,
            'longitud_total_mm': length,
            'fabricante': brand,
            'motores_texto': engine_part if engine_part else None,
            'motores': engines,
            'referencias_oem': oem_refs,
            'pagina_pdf': p_idx + 1
        })

print(f'Parsed {len(records)} valve guides from MRK.pdf.')
print('\nSample 10 items:')
for r in records[:10]:
    print(r)

with open('RecursosExtras/catalogo_mrk_guias.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)
print('\nSaved to RecursosExtras/catalogo_mrk_guias.json')
