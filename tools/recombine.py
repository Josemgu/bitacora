#!/usr/bin/env python3
"""
Script para recombinar archivos divididos en chunks .partNNN
subidos al repositorio de GitHub.

Uso:
    python3 tools/recombine.py

El script busca todos los archivos *.partNNN en el directorio actual
y los recomina en el archivo original, eliminando los chunks despues.
"""

import os
import re
import glob
from collections import defaultdict


def find_chunk_groups():
    """Encuentra grupos de chunks que pertenecen al mismo archivo."""
    # Patron: archivo.ext.partNNN
    pattern = re.compile(r'^(.*)\.part(\d+)$')
    
    groups = defaultdict(list)
    
    for root, dirs, files in os.walk('.'):
        # Ignorar directorios ocultos y node_modules
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        
        for filename in files:
            match = pattern.match(filename)
            if match:
                base_name = match.group(1)  # ej: "seed.js"
                part_num = int(match.group(2))  # ej: 0, 1, 2...
                full_path = os.path.join(root, filename)
                groups[(root, base_name)].append((part_num, full_path))
    
    return groups


def recombine_file(group_key, chunks):
    """Recombina los chunks en el archivo original."""
    root, base_name = group_key
    output_path = os.path.join(root, base_name)
    
    # Ordenar chunks por numero de parte
    chunks.sort(key=lambda x: x[0])
    
    print(f"Recombinando: {base_name} ({len(chunks)} chunks)...")
    
    # Verificar que no falten chunks
    expected_parts = list(range(len(chunks)))
    actual_parts = [c[0] for c in chunks]
    
    if expected_parts != actual_parts:
        missing = set(expected_parts) - set(actual_parts)
        print(f"  ERROR: Faltan chunks: {sorted(missing)}")
        return False
    
    # Recombinar
    try:
        with open(output_path, 'w', encoding='utf-8') as outfile:
            for part_num, chunk_path in chunks:
                with open(chunk_path, 'r', encoding='utf-8') as infile:
                    outfile.write(infile.read())
        
        # Verificar tamaño
        total_size = sum(os.path.getsize(c[1]) for c in chunks)
        output_size = os.path.getsize(output_path)
        
        if total_size == output_size:
            print(f"  OK: {output_size:,} bytes")
            
            # Eliminar chunks
            for part_num, chunk_path in chunks:
                os.remove(chunk_path)
            
            print(f"  Chunks eliminados: {len(chunks)}")
            return True
        else:
            print(f"  ERROR: Tamaño no coincide ({total_size} != {output_size})")
            return False
            
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    print("=" * 60)
    print("Recombinador de archivos - Bitacora")
    print("=" * 60)
    print()
    
    groups = find_chunk_groups()
    
    if not groups:
        print("No se encontraron archivos .part* para recombinar.")
        print("Los archivos ya estan completos o no hay chunks.")
        return
    
    success_count = 0
    error_count = 0
    
    for group_key in sorted(groups.keys()):
        chunks = groups[group_key]
        if recombine_file(group_key, chunks):
            success_count += 1
        else:
            error_count += 1
    
    print()
    print("=" * 60)
    print(f"Resultado: {success_count} exitosos, {error_count} errores")
    print("=" * 60)


if __name__ == '__main__':
    main()
