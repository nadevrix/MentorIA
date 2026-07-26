interface FormattedMessageProps {
  content: string;
}

/**
 * Formatea respuestas de texto de los agentes convirtiendo Markdown básico
 * (tablas, negrita, viñetas) en elementos HTML limpios y estilizados.
 */
export default function FormattedMessage({ content }: FormattedMessageProps) {
  if (!content) return null;

  // Dividir en bloques por párrafos / tablas
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bIdx) => {
        const lines = block.trim().split('\n');

        // Detectar si el bloque es una tabla Markdown (| col | col |)
        const isTable =
          lines.length >= 2 &&
          lines[0].trim().startsWith('|') &&
          lines[0].trim().endsWith('|');

        if (isTable) {
          const headerLine = lines[0];
          // Omitir la línea separadora |---|---|
          const rowLines = lines.slice(1).filter((l) => !l.includes('---'));

          const headers = headerLine
            .split('|')
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0);

          const rows = rowLines.map((line) =>
            line
              .split('|')
              .map((cell) => cell.trim())
              .filter((cell) => cell.length > 0),
          );

          return (
            <div key={bIdx} className="my-2 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-slate-900/60 p-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-left uppercase tracking-wider text-slate-400">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-2 font-semibold">
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/40">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 tabular-nums">
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

        // Detectar si es una lista con viñetas (- o *)
        const isList = lines.every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '));

        if (isList) {
          return (
            <ul key={bIdx} className="list-disc space-y-1 pl-4 text-slate-200">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        // Párrafo de texto normal con salto de línea
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

/** Convierte negritas, código y enlaces seguros de WhatsApp. */
function renderInlineMarkdown(text: string) {
  const parts = text.split(
    /(\*\*.*?\*\*|`.*?`|\[[^\]\n]+\]\(https?:\/\/wa\.me\/[^\s<>()]+\)|https?:\/\/wa\.me\/[^\s<>()\],;!?]+)/g,
  );

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-[var(--color-accent)]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const markdownWhatsApp = part.match(
      /^\[([^\]]+)\]\((https?:\/\/wa\.me\/[^\s<>()]+)\)$/,
    );
    const whatsappUrl =
      markdownWhatsApp?.[2] ??
      (part.startsWith('https://wa.me/') || part.startsWith('http://wa.me/') ? part : null);
    if (whatsappUrl) {
      return (
        <a
          key={idx}
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="my-1.5 inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:scale-105 hover:bg-emerald-500 active:scale-95"
        >
          {markdownWhatsApp?.[1] ?? 'Abrir en WhatsApp'}
        </a>
      );
    }
    return part;
  });
}
