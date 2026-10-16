import { event } from "@/config/event";

/** Shown while event.isSample is true, so nobody pays to a sample account by mistake. */
export function SampleStrip() {
  if (!event.isSample) return null;
  return (
    <p className="sample-strip" role="note">
      <strong>Sample details.</strong> The date, venue and payment accounts on this site are placeholders. Edit
      src/config/event.ts and set isSample to false before sharing the link.
    </p>
  );
}
