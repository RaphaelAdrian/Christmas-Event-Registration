import Link from "next/link";
import { event } from "@/config/event";

export default function NotFound() {
  return (
    <main
      id="main"
      style={{ minHeight: "100svh", padding: "24px var(--margin) 96px", display: "grid", alignContent: "space-between" }}
    >
      <Link href="/" style={{ fontSize: "var(--step-lead)", fontWeight: 600, letterSpacing: "-0.03em", textDecoration: "none" }}>
        {event.shortName}
      </Link>
      <div>
        <h1 style={{ fontSize: "var(--step-head)" }}>This page doesn&rsquo;t exist</h1>
        <p style={{ marginTop: 20, fontSize: "var(--step-lead)" }}>
          <Link href="/">Go to the event page</Link>
        </p>
      </div>
    </main>
  );
}
