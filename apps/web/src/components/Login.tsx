import { useState, type FormEvent } from 'react';
import { useSesion } from '../lib/sesion';
import BrainMark from './BrainMark';
import Icon from './Icon';

/**
 * Pantalla de acceso: entrar o registrarse.
 *
 * Los dos modos comparten componente porque comparten casi todo —el formulario,
 * la advertencia, el vuelta atrás—; separarlos en dos archivos habría duplicado
 * la advertencia, que es justo lo que no puede quedar desincronizado.
 *
 * SOBRE LA CONTRASEÑA, que es la decisión delicada de este archivo:
 *
 * El proyecto no tiene autenticación (CLAUDE.md: "No hay autenticación ni
 * aislamiento multiempresa"). No hay usuarios en el backend: registrarse no
 * crea una cuenta en ningún lado, abre la misma sesión local que entrar.
 *
 * Lo que NO se hace, y por qué:
 *  - La contraseña no se guarda: ni en localStorage ni más allá del submit.
 *  - No se envía a ningún lado.
 *  - No se compara contra un valor quemado en el código, porque eso daría la
 *    apariencia de una validación que no protege nada.
 *  - autoComplete="new-password" para que el navegador no ofrezca guardar una
 *    credencial de un servicio que no autentica.
 *
 * Lo único que sí se valida es que las dos contraseñas del registro coincidan:
 * eso es ayuda real al usuario y no promete seguridad que no existe.
 */

/**
 * Credencial de la demo.
 *
 * Vive en el frontend, así que viaja en el bundle y está en el repo: cualquiera
 * puede leerla. No es un descuido ni algo a "esconder mejor" — sin backend de
 * usuarios no hay dónde más ponerla, y no protege nada de todos modos: el panel
 * y la API responden igual sin pasar por acá.
 *
 * Es un portero para que la demo tenga la forma del producto, no una cerradura.
 * Por eso la pantalla la muestra en vez de fingir que es secreta.
 */
const DEMO = { usuario: 'admin123', password: 'admin123' };

export type ModoAcceso = 'login' | 'registro';

interface Props {
  modo: ModoAcceso;
  onModo: (modo: ModoAcceso) => void;
  onVolver: () => void;
}

const TEXTOS = {
  login: {
    titulo: 'Iniciar sesión',
    boton: 'Entrar',
    pie: '¿No tenés cuenta?',
    enlace: 'Registrate',
    otro: 'registro' as ModoAcceso,
  },
  registro: {
    titulo: 'Crear cuenta',
    boton: 'Registrarme',
    pie: '¿Ya tenés cuenta?',
    enlace: 'Iniciá sesión',
    otro: 'login' as ModoAcceso,
  },
};

export default function Login({ modo, onModo, onVolver }: Props) {
  const { entrar } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);

  const t = TEXTOS[modo];
  const esRegistro = modo === 'registro';

  function limpiar<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setError(null);
    };
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (usuario.trim().length < 2) {
      setError('Escribí tu usuario.');
      return;
    }
    if (password.length === 0) {
      setError('Escribí una contraseña.');
      return;
    }
    if (esRegistro && password !== repetir) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!esRegistro && (usuario.trim() !== DEMO.usuario || password !== DEMO.password)) {
      // Un solo mensaje para los dos casos: decir cuál de los dos falló le
      // serviría a quien prueba credenciales, no a quien se equivocó tipeando.
      setError('Usuario o contraseña incorrectos.');
      return;
    }
    // La contraseña muere acá: no viaja a ningún lado y no se guarda.
    entrar({ usuario: usuario.trim() });
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="w-full max-w-[400px]">
        <form onSubmit={onSubmit} className="rounded-[var(--radius-card)] glass p-7">
          <div className="flex items-center gap-2.5">
            <BrainMark size={30} className="text-[var(--color-accent)]" />
            <span className="text-[15px] font-bold tracking-tight">
              Mentor <span className="text-[var(--color-accent)]">IA</span>
            </span>
          </div>

          <h1 className="mt-6 text-[22px] font-bold leading-tight">{t.titulo}</h1>

          <label className="mt-6 block">
            <span className="text-xs font-semibold text-[var(--color-muted)]">Usuario</span>
            <input
              value={usuario}
              onChange={(e) => limpiar(setUsuario)(e.target.value)}
              placeholder="tu usuario"
              maxLength={60}
              autoFocus
              autoComplete="username"
              className="mt-1.5 w-full rounded-xl glass-soft px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-[var(--color-muted)]">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => limpiar(setPassword)(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl glass-soft px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          {esRegistro && (
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                Repetir contraseña
              </span>
              <input
                type="password"
                value={repetir}
                onChange={(e) => limpiar(setRepetir)(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-xl glass-soft px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)] focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </label>
          )}

          {/* Altura reservada: el mensaje de error no empuja el botón hacia abajo. */}
          <p className="mt-3 flex min-h-[18px] items-center gap-1.5 text-xs font-semibold text-[var(--color-bad)]">
            {error && (
              <>
                <Icon name="warning" size={13} />
                {error}
              </>
            )}
          </p>

          <button
            type="submit"
            className="mt-3 w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-strong)]"
          >
            {t.boton}
          </button>

          <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
            {t.pie}{' '}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRepetir('');
                onModo(t.otro);
              }}
              className="font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline"
            >
              {t.enlace}
            </button>
          </p>

          <button
            type="button"
            onClick={onVolver}
            className="mt-3 w-full rounded-full px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
          >
            Volver
          </button>

          {/*
            Esta advertencia no se saca "porque afea la demo". Es lo que separa
            un formulario honesto de uno que finge proteger algo.
          */}
          {!esRegistro && (
            <p className="mt-4 rounded-xl bg-[var(--color-accent)]/8 px-3.5 py-2.5 text-center text-xs text-[var(--color-muted)]">
              Acceso de demo: <code className="font-semibold text-[var(--color-fg)]">admin123</code>{' '}
              / <code className="font-semibold text-[var(--color-fg)]">admin123</code>
            </p>
          )}

          <p className="mt-5 border-t border-[var(--color-line)] pt-4 text-[11px] leading-relaxed text-[var(--color-faint)]">
            <strong className="font-semibold text-[var(--color-muted)]">Demo del Buildathon.</strong>{' '}
            Todavía no hay cuentas de usuario:{' '}
            {esRegistro
              ? 'registrarte no crea una cuenta en ningún servidor'
              : 'la credencial se compara en el navegador y no protege los datos'}{' '}
            y la contraseña no se guarda ni se envía. No uses una contraseña real.
          </p>
        </form>
      </div>
    </div>
  );
}
