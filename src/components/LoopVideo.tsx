"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A short muted clip that loops while it is on screen and pauses when it
 * scrolls away, so phones don't keep playing (or downloading) it. People who
 * ask for reduced motion get a still frame with the usual video controls.
 */
export function LoopVideo({ src, label, className }: { src: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefersReduced);
    if (prefersReduced) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      // "#t=0.1" makes Safari show the first frame before the clip plays
      src={`${src}#t=0.1`}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      controls={reduced}
    />
  );
}
