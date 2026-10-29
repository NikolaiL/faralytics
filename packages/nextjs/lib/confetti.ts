const celebrated = new Set<string>();

/** A short, non-interactive burst for a confirmed transaction; never blocks payment completion. */
export function celebrateTransaction(hash: string) {
  let layer: HTMLDivElement | undefined;
  try {
    if (
      typeof window === "undefined" ||
      celebrated.has(hash) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    celebrated.add(hash);
    layer = document.createElement("div");
    layer.dataset.testid = "transaction-confetti";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: "10000",
    });
    document.body.appendChild(layer);
    const colors = ["#d6ff3f", "#855dcd", "#b596f2", "#f3eff9"];
    for (let i = 0; i < 72; i++) {
      const piece = document.createElement("i");
      Object.assign(piece.style, {
        position: "absolute",
        left: "50%",
        top: "42%",
        width: "7px",
        height: i % 3 ? "10px" : "7px",
        borderRadius: i % 3 ? "1px" : "50%",
        background: colors[i % colors.length],
      });
      layer.appendChild(piece);
      const spread = (((i * 37) % 73) / 36 - 1) * window.innerWidth * 0.65;
      const rise = 70 + ((i * 53) % 180);
      const rotation = 180 + ((i * 137) % 900);
      piece.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          {
            offset: 0.3,
            transform: `translate(${spread * 0.65}px, ${-rise}px) rotate(${rotation * 0.35}deg)`,
            opacity: 1,
          },
          { transform: `translate(${spread}px, ${window.innerHeight * 0.7}px) rotate(${rotation}deg)`, opacity: 0 },
        ],
        { duration: 1900 + (i % 7) * 100, easing: "cubic-bezier(.2,.7,.5,1)", fill: "forwards" },
      );
    }
    window.setTimeout(() => layer?.remove(), 2_700);
  } catch {
    layer?.remove(); /* Animation must never interrupt a confirmed payment. */
  }
}
