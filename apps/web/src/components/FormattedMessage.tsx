interface FormattedMessageProps {
  content: string;
}

/**
 * Formatea las respuestas de los agentes: convierte el Markdown básico que
 * escribe el modelo (tablas, negrita, listas, código) en HTML estilado.
 *
 * OJO CON LOS COLORES: este componente se escribió para el tema oscuro y quedó
 * así cuando la interfaz pasó a claro. La negrita iba en `text-white` y el
 * cuerpo de las listas en `text-slate-200`, que sobre el vidrio claro miden
 * 1,14:1 y 1,09:1 — no "poco contraste": invisible. En un producto que muestra
 * el tipo de cambio en negrita, eso borraba justo la cifra.
 *
 * Por eso acá no hay colores sueltos: todo sale de los tokens de la interfaz,
 * que son los que están medidos contra la superficie real del vidrio.
 */
export default function FormattedMessage({ content }: FormattedMessageProps) {
  if (!content) return null;

  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bIdx) => {
        const lines = block.trim().split('\n');
        const primera = lines[0]?.trim() ?? '';

        // Tabla Markdown: | col | col |
        const isTable = lines.length >= 2 && primera.startsWith('|') && primera.endsWith('|');

        if (isTable) {
          const rowLines = lines.slice(1).filter((l) => !l.includes('---'));
          const celdas = (linea: string) =>
            linea
              .split('|')
              .map((c) => c.trim())
              .filter((c) => c.length > 0);

          const headers = celdas(primera);
          const rows = rowLines.map(celdas);

          return (
            // La tabla scrollea sola: una tabla ancha no puede empujar el chat.
            <div
              key={bIdx}
              className="my-2 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-black/[0.02]"
            >
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left uppercase tracking-wide text-[var(--color-muted)]">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 font-semibold">
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-t border-[var(--color-line)]">
                      {row.map((cell, cIdx) => (
                        // tabular-nums: las cifras de una columna tienen que alinearse.
                        <td key={cIdx} className="px-3 py-2 tabular-nums">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Lista con viñetas
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bIdx} className="list-disc space-y-1 pl-5 marker:text-[var(--color-faint)]">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        /*
         * Lista numerada. Antes caía en el caso de párrafo, así que "1." quedaba
         * pegado al texto sin sangría y los ítems no se leían como pasos. Los
         * agentes responden en pasos numerados casi siempre, así que vale.
         */
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol
              key={bIdx}
              className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[var(--color-muted)]"
            >
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{renderInlineMarkdown(line.trim().replace(/^\d+[.)]\s+/, ''))}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={bIdx} className="whitespace-pre-wrap">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {renderInlineMarkdown(line)}
                {lIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Convierte negritas, código y enlaces de WhatsApp. */
function renderInlineMarkdown(text: string) {
  const parts = text.split(
    /(\*\*.*?\*\*|`.*?`|\[[^\]\n]+\]\(https?:\/\/wa\.me\/[^\s<>()]+\)|https?:\/\/wa\.me\/[^\s<>()\],;!?]+)/g,
  );

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // El color del cuerpo, no uno propio: la negrita destaca por peso.
      return (
        <strong key={idx} className="font-semibold text-[var(--color-fg)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-xs text-[var(--color-accent)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const markdownWhatsApp = part.match(/^\[([^\]]+)\]\((https?:\/\/wa\.me\/[^\s<>()]+)\)$/);
    const whatsappUrl =
      markdownWhatsApp?.[2] ??
      (part.startsWith('https://wa.me/') || part.startsWith('http://wa.me/') ? part : null);
    if (whatsappUrl) {
      return (
        // emerald-700 y no 600: con 600 el texto blanco daba 3,77:1 y no pasa AA.
        <a
          key={idx}
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="my-1.5 inline-flex items-center rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
        >
          {markdownWhatsApp?.[1] ?? 'Abrir en WhatsApp'}
        </a>
      );
    }
    return part;
  });
}
