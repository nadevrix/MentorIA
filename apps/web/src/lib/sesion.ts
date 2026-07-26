import { useCallback, useSyncExternalStore } from 'react';

/**
 * Sesión de la demo.
 *
 * QUÉ ES Y QUÉ NO ES, porque la diferencia importa:
 *
 * Esto NO es autenticación. No hay usuarios en el backend, ni contraseñas
 * guardadas, ni sesiones del servidor, ni aislamiento de datos entre empresas
 * (CLAUDE.md lo dice explícito). Es una puerta de entrada para la demo: decide
 * qué pantalla se muestra, nada más.
 *
 * Por eso la contraseña que se escribe en el formulario NUNCA llega hasta acá.
 * Guardar —aunque sea en el navegador— una contraseña que no protege nada sería
 * lo peor de los dos mundos: no da seguridad y sí expone a quien reutiliza sus
 * claves. El formulario la pide para que la demo se vea como el producto real,
 * la descarta al enviar, y lo dice en pantalla.
 *
 * Cuando exista autenticación de verdad, este archivo se reemplaza por el
 * cliente de esa API y el resto de la interfaz no se entera.
 */

export interface Sesion {
  usuario: string;
  /** ISO. Sirve para mostrar desde cuándo está abierta. */
  desde: string;
}

const CLAVE = 'mentoria.sesion';

function sanear(bruto: unknown): Sesion | null {
  if (typeof bruto !== 'object' || bruto === null) return null;
  const s = bruto as Record<string, unknown>;
  if (typeof s.usuario !== 'string' || s.usuario.trim() === '') return null;
  return {
    usuario: s.usuario.slice(0, 60),
    desde: typeof s.desde === 'string' ? s.desde : new Date().toISOString(),
  };
}

function leer(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? sanear(JSON.parse(crudo)) : null;
  } catch {
    // Modo privado, almacenamiento lleno o JSON roto: se entra sin sesión.
    return null;
  }
}

let actual: Sesion | null = typeof localStorage === 'undefined' ? null : leer();
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const o of oyentes) o();
}

function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  // Cerrar sesión en una pestaña tiene que cerrarla en todas.
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

/** Referencia estable: si devolviera un objeto nuevo, useSyncExternalStore entraría en bucle. */
const instantanea = (): Sesion | null => actual;

/**
 * Abre la sesión.
 *
 * Recibe SÓLO el usuario. La contraseña se queda en el formulario y no llega
 * hasta acá: no es un descuido, es el punto (ver la cabecera del archivo).
 */
export function iniciarSesion(datos: { usuario: string }): void {
  actual = {
    usuario: datos.usuario.trim().slice(0, 60),
    desde: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // Sin persistencia la sesión vive hasta recargar. No es motivo para no entrar.
  }
  avisar();
}

export function cerrarSesion(): void {
  actual = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
  avisar();
}

export function useSesion(): {
  sesion: Sesion | null;
  entrar: (datos: { usuario: string }) => void;
  salir: () => void;
} {
  const sesion = useSyncExternalStore(suscribir, instantanea, () => null);
  return {
    sesion,
    entrar: useCallback(iniciarSesion, []),
    salir: useCallback(cerrarSesion, []),
  };
}
