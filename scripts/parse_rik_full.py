import sys
import pypdf
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

def get_maker_from_page(page_num, text):
    t = text.upper()
    if 15 <= page_num <= 18:
        return 'Daihatsu'
    elif 19 <= page_num <= 20:
        return 'Subaru'
    elif 21 <= page_num <= 28:
        return 'Hino'
    elif 29 <= page_num <= 40:
        return 'Isuzu'
    elif 41 <= page_num <= 57:
        return 'Mitsubishi'
    elif 58 <= page_num <= 73:
        return 'Nissan'
    elif 74 <= page_num <= 77:
        return 'Nissan Diesel'
    elif 78 <= page_num <= 94:
        return 'Toyota'
    elif 95 <= page_num <= 102:
        return 'Mazda'
    elif 103 <= page_num <= 105:
        return 'Suzuki'
    elif 106 <= page_num <= 111:
        return 'Honda'
    elif 112 <= page_num <= 125:
        if 'HYUNDAI' in t:
            return 'Hyundai'
        elif 'KIA' in t:
            return 'Kia'
        elif 'DAEWOO' in t:
            return 'Daewoo'
        return 'Korean Car'
    return 'Universal'

def is_noise_line(line):
    l = line.strip().upper()
    if any(h in l for h in ['ENGINE TYPE', 'エンジン型式', 'PISTON RING SETS', 'OLD SET NO.', 'DIESEL-ENGINE', 'GASOLINE-ENGINE']):
        return True
    if 'MOTOR' in l and any(k in l for k in ['CORP', 'LTD', 'CO.', 'CO,', 'CO ']):
        return True
    if any(m in l for m in ['DAIHATSU', 'SUBARU', 'HINO', 'ISUZU', 'MITSUBISHI', 'TOYOTA', 'TOYOYA', 'NISSAN', 'MAZDA', 'SUZUKI', 'HONDA', 'KOREAN']) and any(k in l for k in ['CORP', 'LTD', 'CO.', 'CO,', 'CO ', 'AUTOMOBILE', 'DIESEL-ENGINE']):
        return True
    if re.match(r'^[ー−-]\s*\d+\s*[ー−-]$', line):
        return True
    # Letras japonesas o caracteres especiales no ascii de pie de página
    if any('\u3000' <= c <= '\u303f' or '\u3040' <= c <= '\u309f' or '\u30a0' <= c <= '\u30ff' or '\u4e00' <= c <= '\u9fff' or '\u0c00' <= c <= '\u0dff' for c in line):
        return True
    return False

def is_oem_or_remark(line):
    l = line.strip().upper()
    if 'KEYSTONE' in l:
        return True
    if '/CYL' in l:
        return True
    if re.search(r'\b\d{4,6}[A-Z]?\b', l) and ('OLD' in l or '(' in l):
        return True
    # Códigos OEM típicos como 13011-56040 o 04130-47010 o -40051
    if re.search(r'\b[A-Z0-9]{3,6}-[A-Z0-9]{4,6}\b', l):
        return True
    if re.match(r'^[-\s,0-9A-Z/]{3,25}$', l) and any(c.isdigit() for c in l) and ('-' in l or ',' in l):
        return True
    return False

def parse_all_rik_pages(pdf_path):
    reader = pypdf.PdfReader(pdf_path)
    all_sets = []
    ring_re = re.compile(r'^\s*([0-4])\s+(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)(.*)$')
    
    current_engine_lines = []
    last_engine_name = 'Universal'
    last_maker = 'Universal'
    
    for page_idx in range(14, 125):
        page_num = page_idx + 1
        page = reader.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue
            
        maker = get_maker_from_page(page_num, text)
        if maker != last_maker:
            last_engine_name = 'Universal'
            last_maker = maker
            
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            if is_noise_line(line):
                i += 1
                continue
                
            m_ring = ring_re.match(line)
            if m_ring and m_ring.group(1) == '1':
                # Inicio de juego de anillos
                ring_lines = [ (line, m_ring) ]
                remarks_lines = []
                
                rest1 = m_ring.group(5).strip()
                if rest1:
                    remarks_lines.append(rest1)
                
                j = i + 1
                while j < len(lines):
                    next_line = lines[j]
                    
                    if is_noise_line(next_line):
                        j += 1
                        continue
                        
                    next_ring = ring_re.match(next_line)
                    if next_ring and next_ring.group(1) == '1':
                        break
                        
                    if next_ring:
                        ring_lines.append((next_line, next_ring))
                        rest_n = next_ring.group(5).strip()
                        if rest_n:
                            remarks_lines.append(rest_n)
                        j += 1
                    else:
                        if is_oem_or_remark(next_line):
                            remarks_lines.append(next_line)
                            j += 1
                        else:
                            # Puede ser el inicio de los motores del siguiente set
                            break
                            
                parsed = process_set(maker, page_num, current_engine_lines, ring_lines, remarks_lines, last_engine_name)
                if parsed:
                    all_sets.append(parsed)
                    if parsed['motor_principal'] and parsed['motor_principal'] != 'Universal':
                        last_engine_name = parsed['motor_principal']
                    
                current_engine_lines = []
                i = j
            else:
                if is_oem_or_remark(line):
                    if all_sets and ('KEYSTONE' in line.upper() or re.search(r'\b\d{5}-\d{5}\b', line)):
                        all_sets[-1]['remarks_raw'].append(line)
                        if 'KEYSTONE' in line.upper():
                            is_half = 'HALF' in line.upper()
                            all_sets[-1]['diseno_conico'] = True
                            all_sets[-1]['keystone_tipo'] = '1ST=HALF KEYSTONE' if is_half else '1ST=KEYSTONE'
                            all_sets[-1]['anillos'][0]['forma'] = 'HALF KEYSTONE (Semi-cónico)' if is_half else 'KEYSTONE (Cónico)'
                            all_sets[-1]['anillos'][0]['diseno_conico'] = True
                else:
                    if not is_noise_line(line):
                        current_engine_lines.append(line)
                i += 1
                
    return all_sets

def process_set(maker, page_num, engine_lines, ring_lines, remarks_lines, fallback_engine):
    anillos = []
    set_no = None
    set_type = None
    all_tokens = []
    
    for l_text, m in ring_lines:
        pos_raw = m.group(1)
        d1 = float(m.group(2))
        h1 = float(m.group(3))
        a1 = float(m.group(4))
        rest = m.group(5).strip()
        
        pos_label = 'Anillo de aceite' if pos_raw == '0' else f'Anillo {pos_raw}'
        
        tokens = rest.split()
        all_tokens.extend(tokens)
        
        for t in tokens:
            cleaned = t.replace('(', '').replace(')', '').replace(',', '').strip()
            if cleaned.isdigit() and len(cleaned) == 5 and not set_no:
                set_no = cleaned
            elif cleaned.upper() in ['SV', 'FX', 'FM', 'SM', 'FV', 'RN', 'GN'] and not set_type:
                set_type = cleaned.upper()
                
        anillos.append({
            'posicion': pos_label,
            'posicion_raw': pos_raw,
            'd1': d1,
            'h1': h1,
            'a1': a1,
            'rest': rest
        })
        
    full_remarks = ' '.join(remarks_lines + all_tokens)
    full_remarks_upper = full_remarks.upper()
    
    # Detección de KEYSTONE
    is_keystone = 'KEYSTONE' in full_remarks_upper
    is_half_keystone = 'HALF' in full_remarks_upper and 'KEYSTONE' in full_remarks_upper
    
    keystone_label = None
    if is_half_keystone:
        keystone_label = '1ST=HALF KEYSTONE'
    elif is_keystone:
        keystone_label = '1ST=KEYSTONE'
        
    if is_keystone:
        anillos[0]['forma'] = 'HALF KEYSTONE (Semi-cónico)' if is_half_keystone else 'KEYSTONE (Cónico)'
        anillos[0]['diseno_conico'] = True
    else:
        anillos[0]['forma'] = 'RECTANGULAR'
        anillos[0]['diseno_conico'] = False
        
    # Extracción de cilindros
    cilindros = None
    for el in reversed(engine_lines):
        el_strip = el.strip()
        if el_strip.isdigit() and int(el_strip) in [2, 3, 4, 5, 6, 8, 10, 12]:
            cilindros = int(el_strip)
            break
            
    # Vehículos y Motores
    vehiculos = []
    motores = []
    cc = None
    
    for el in engine_lines:
        el = el.strip()
        if not el or (el.isdigit() and int(el) in [2, 3, 4, 5, 6, 8, 10, 12]):
            continue
        if is_noise_line(el):
            continue
        if el.startswith('●'):
            vehiculos.append(el.replace('●', '').strip())
        elif any(c in el for c in ['Bu', 'M100', 'G10', 'CK20', 'HM300', 'FB', 'KM']) and ',' in el:
            vehiculos.append(el)
        else:
            # Línea de motor (posiblemente con CC)
            m_cc = re.search(r'\b(\d{3,5})\b', el)
            if m_cc and not cc and int(m_cc.group(1)) > 300:
                cc = int(m_cc.group(1))
                mot_name = el.replace(m_cc.group(1), '').strip()
                if mot_name and not is_oem_or_remark(mot_name) and not is_noise_line(mot_name):
                    motores.append(mot_name)
            else:
                if not is_oem_or_remark(el) and len(el) > 1 and not el.startswith('ー') and not is_noise_line(el):
                    motores.append(el)
                    
    motor_principal = motores[0] if motores else fallback_engine
    
    # Extraer referencias OEM robustamente
    oem_refs = []
    tokens = re.split(r'[\s,]+', full_remarks)
    for tok in tokens:
        t = re.sub(r'[()]', '', tok)
        t = re.sub(r'/cyl\.?$', '', t, flags=re.I).strip()
        if not t or t == set_no:
            continue
        if re.match(r'^(KEYSTONE|HALF|CR1|CR2|CR3|CR4|RN|GN|SV|FX|FM|SM|FV|RN|STD|FE|CYL|SET|TOP|2ND|OIL|NEW|OLD|P|T|O|EXP|CH|BF|CO|L1|L2)$', t, flags=re.I):
            continue
        if 'KEYSTONE' in t.upper() or re.match(r'^\d+x\d+', t, flags=re.I):
            continue
        clean_chars = re.sub(r'[^A-Z0-9]', '', t, flags=re.I)
        if len(clean_chars) < 7:
            continue
        if re.match(r'^[A-Z0-9]{1,6}(?:-[A-Z0-9]{1,6}){1,4}$', t, flags=re.I) and any(c.isdigit() for c in t) and '-' in t:
            if re.match(r'^[A-Z0-9]{3,5}-[A-Z]{1,2}$', t, flags=re.I):
                continue
            t_upper = t.upper()
            if t_upper not in oem_refs:
                oem_refs.append(t_upper)
        elif re.match(r'^(?:MD|ME|MB|MC|MN|MR|OK|K\d|A\d|B\d|C\d)\d{5,7}[A-Z]?$', t, flags=re.I):
            t_upper = t.upper()
            if t_upper not in oem_refs:
                oem_refs.append(t_upper)
            
    return {
        'marca_fabricante': maker,
        'codigo_rik': set_no or f"RIK-{anillos[0]['d1']}-{page_num}",
        'set_no': set_no,
        'set_type': set_type,
        'motor_principal': motor_principal,
        'motores_compatibles': motores if motores else ([fallback_engine] if fallback_engine != 'Universal' else []),
        'vehiculos': vehiculos,
        'cilindros': cilindros,
        'cilindrada_cc': cc,
        'diametro_cilindro_mm': anillos[0]['d1'],
        'espesor_anillo1_mm': anillos[0]['h1'],
        'espesor_anillo2_mm': anillos[1]['h1'] if len(anillos) > 1 else None,
        'espesor_aceite_mm': anillos[-1]['h1'] if len(anillos) > 2 else None,
        'diseno_conico': is_keystone,
        'keystone_tipo': keystone_label,
        'anillos': anillos,
        'referencias_oem': oem_refs,
        'remarks_raw': remarks_lines,
        'pagina_pdf': page_num
    }

if __name__ == '__main__':
    sets = parse_all_rik_pages('RecursosExtras/Anillos Rik.pdf')
    print(f"✅ Total juegos parseados: {len(sets)}")
    keystones = [s for s in sets if s['diseno_conico']]
    print(f"🔥 Juegos con KEYSTONE (Diseño Cónico): {len(keystones)}")
    
    out_path = 'RecursosExtras/catalogo_rik.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(sets, f, ensure_ascii=False, indent=2)
    print(f"💾 Guardado catálogo completo en {out_path} ({len(sets)} registros)")
