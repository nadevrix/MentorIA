import { useCallback, useSyncExternalStore } from 'react';

/**
 * Perfil del negocio: los pocos datos que cambian lo que la app le muestra al
 * comercio.
 *
 * Vive acá y no dentro de cada panel porque el mismo dato lo usan varios:
 * el dígito del NIT decide el vencimiento en Impuestos, y el tipo de sociedad
 * decide qué trámites corresponden en Trámites. Cuando cada panel guardaba lo
 * suyo, cambiarlo en un lado dejaba al otro mostrando algo distinto.
 *
 * Se guarda en el navegador, no en el servidor. El NIT completo NO se guarda en
 * ningún lado: sólo el último dígito, que es lo único que hace falta para las
 * fechas.
 */

export type Regimen = 'general' | 'simplificado';
export type TipoSociedad = 'unipersonal' | 'srl' | 'sa';

export interface Perfil {
  negocio: string;
  digitoNit: number;
  regimen: Regimen;
  tipoSociedad: TipoSociedad;
  conEmpleados: boolean;
  rubros: string[];
}

export const PERFIL_INICIAL: Perfil = {
  negocio: '',
  digitoNit: 0,
  regimen: 'general',
  tipoSociedad: 'srl',
  conEmpleados: false,
  rubros: [],
};

export const RUBROS = [
  { id: 'importador', label: 'Importa' },
  { id: 'alimentos', label: 'Alimentos' },
  { id: 'industria', label: 'Industria' },
] as const;

const CLAVE = 'mentoria.perfil';

/** Lo guardado puede ser viejo o estar tocado a mano: se valida campo por campo. */
function sanear(bruto: unknown): Perfil {
  if (typeof bruto !== 'object' || bruto === null) return PERFIL_INICIAL;
  const p = bruto as Record<string, unknown>;
  const digito = Number(p.digitoNit);
  return {
    negocio: typeof p.negocio === 'string' ? p.negocio.slice(0, 60) : '',
    digitoNit: Number.isInteger(digito) && digito >= 0 && digito <= 9 ? digito : 0,
    regimen: p.regimen === 'simplificado' ? 'simplificado' : 'general',
    tipoSociedad:
      p.tipoSociedad === 'unipersonal' || p.tipoSociedad === 'sa'
        ? p.tipoSociedad
        : 'srl',
    conEmpleados: p.conEmpleados === true,
    rubros: Array.isArray(p.rubros)
      ? p.rubros.filter((r): r is string => RUBROS.some((x) => x.id === r))
      : [],
  };
}

function leer(): Perfil {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? sanear(JSON.parse(crudo)) : PERFIL_INICIAL;
  } catch {
    // Modo privado, almacenamiento lleno o JSON roto: se arranca de cero.
    return PERFIL_INICIAL;
  }
}

let actual: Perfil = typeof localStorage === 'undefined' ? PERFIL_INICIAL : leer();
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const o of oyentes) o();
}

function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  // Otra pestaña abierta del mismo negocio también cambia el perfil.
  const desdeOtraPestania = (e: StorageEvent) => {
    if (e.key !== CLAVE) return;
    actual = leer();
    avisar();
  };
  window.addEventListener('storage', desdeOtraPestania);
  return () => {
    oyentes.delete(fn);
    window.removeEventListener('storage', desdeOtraPestania);
  };
}

/**
 * Referencia estable entre renders: sólo se reemplaza al guardar. Si devolviera
 * un objeto nuevo cada vez, useSyncExternalStore entraría en bucle.
 */
const instantanea = (): Perfil => actual;

export function guardarPerfil(cambio: Partial<Perfil>): void {
  actual = { ...actual, ...cambio };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // Que no se pueda persistir no puede romper la sesión en curso.
  }
  avisar();
}

export function usePerfil(): [Perfil, (cambio: Partial<Perfil>) => void] {
  const perfil = useSyncExternalStore(suscribir, instantanea, () => PERFIL_INICIAL);
  return [perfil, useCallback(guardarPerfil, [])];
}
