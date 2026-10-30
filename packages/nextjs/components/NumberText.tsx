/** Emphasize numeric text without changing surrounding labels or account names. */
export function NumberText({ children, preserveSpaces = false }: { children: string; preserveSpaces?: boolean }) {
  return (
    <span>
      {children.split(/(\d[\d,.]*)/g).map((part, index) =>
        /^\d/.test(part) ? (
          <span className="numeric-value" style={{ fontWeight: 900 }} key={index}>
            {part}
          </span>
        ) : preserveSpaces ? (
          part.replace(/ /g, "\u00a0")
        ) : (
          part
        ),
      )}
    </span>
  );
}
