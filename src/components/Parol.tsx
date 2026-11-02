/**
 * A parol, the Filipino Christmas star lantern, drawn as a hard-edged shard
 * star in a ring with angled tails. A violet copy sits offset behind it, the
 * way the reference artwork misregisters its edges. No glow, no blur.
 * Sized in em so it can sit in a line of type.
 */
export function Parol({ className }: { className?: string }) {
  // Points of a sharp five-pointed star centred on (50, 48)
  const star = (outer: number, inner: number, dx = 0, dy = 0) =>
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      return `${(50 + dx + r * Math.cos(a)).toFixed(2)},${(48 + dy + r * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  const tails = "M27 82 L19 112 L24 112 L14 146 M73 82 L81 112 L76 112 L86 146 M50 80 L50 140";

  return (
    <svg className={className} viewBox="0 0 100 150" aria-hidden="true" focusable="false">
      {/* The offset copy */}
      <g transform="translate(5 5)" fill="none" stroke="var(--parol-shadow, var(--uv))" strokeWidth="6" strokeLinejoin="miter">
        <circle cx="50" cy="48" r="30" />
        <path d={tails} />
      </g>
      <polygon points={star(48, 15, 5, 5)} fill="var(--parol-shadow, var(--uv))" />
      {/* The lantern */}
      <circle cx="50" cy="48" r="30" fill="none" stroke="var(--parol-frame, currentColor)" strokeWidth="6" />
      <path d={tails} fill="none" stroke="var(--parol-frame, currentColor)" strokeWidth="6" strokeLinejoin="miter" />
      <polygon points={star(48, 15)} fill="var(--parol-light, currentColor)" />
      <polygon points={star(18, 6)} fill="var(--parol-core, var(--bone))" />
    </svg>
  );
}
