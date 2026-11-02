import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseUrl } from "@/lib/supabase/env";

/** Cache tag for everything on the public event page. Admin edits revalidate it. */
export const EVENT_TAG = "event";

export type EventSettings = {
  name: string;
  shortName: string;
  tagline: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  mapUrl: string;
  callTime: string;
  shuttleInfo: string;
  organizer: string;
  contactEmail: string;
  registrationOpen: boolean;
  inviteOnly: boolean;
  referencePrefix: string;
  terms: string;
  privacyNotice: string;
};

export type EventDetail = { id: string; title: string; body: string; position: number };

export type GalleryPhoto = {
  id: string;
  storagePath: string;
  caption: string;
  width: number | null;
  height: number | null;
  position: number;
  url: string;
};

/**
 * Shown only if the database can't be reached (for example during a build
 * without Supabase keys). The real values live in the event_settings table.
 */
export const FALLBACK_SETTINGS: EventSettings = {
  name: "EMC-Christmas-Party Fest! 2026",
  shortName: "EMC Christmas Party",
  tagline: "Our year-end celebration at San Roque's Peak Resort.",
  startsAt: "2026-12-12T15:00:00+08:00",
  endsAt: "2026-12-13T00:00:00+08:00",
  venueName: "San Roque's Peak Resort",
  venueAddress: "",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=San+Roque%27s+Peak+Resort",
  callTime: "1:00 PM",
  shuttleInfo: "Free shuttle from KFC Tikling, near SM Taytay.",
  organizer: "",
  contactEmail: "",
  registrationOpen: false,
  inviteOnly: true,
  referencePrefix: "EMC",
  terms: "",
  privacyNotice: "",
};

type SettingsRow = {
  name: string;
  short_name: string;
  tagline: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  venue_address: string;
  map_url: string;
  call_time: string;
  shuttle_info: string;
  organizer: string;
  contact_email: string;
  registration_open: boolean;
  invite_only: boolean;
  reference_prefix: string;
  terms: string;
  privacy_notice: string;
};

export const SETTINGS_COLUMNS =
  "name, short_name, tagline, starts_at, ends_at, venue_name, venue_address, map_url, call_time, shuttle_info, organizer, contact_email, registration_open, invite_only, reference_prefix, terms, privacy_notice";

export function settingsFromRow(r: SettingsRow): EventSettings {
  return {
    name: r.name,
    shortName: r.short_name,
    tagline: r.tagline,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    venueName: r.venue_name,
    venueAddress: r.venue_address,
    mapUrl: r.map_url,
    callTime: r.call_time,
    shuttleInfo: r.shuttle_info,
    organizer: r.organizer,
    contactEmail: r.contact_email,
    registrationOpen: r.registration_open,
    inviteOnly: r.invite_only,
    referencePrefix: r.reference_prefix,
    terms: r.terms,
    privacyNotice: r.privacy_notice,
  };
}

const loadSettings = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient()
      .from("event_settings")
      .select(SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "event_settings row is missing");
    return settingsFromRow(data as SettingsRow);
  },
  ["event-settings"],
  { tags: [EVENT_TAG], revalidate: 300 },
);

const loadDetails = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient()
      .from("event_details")
      .select("id, title, body, position")
      .order("position")
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as EventDetail[];
  },
  ["event-details"],
  { tags: [EVENT_TAG], revalidate: 300 },
);

const loadGallery = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient()
      .from("gallery_photos")
      .select("id, storage_path, caption, width, height, position")
      .order("position")
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      storagePath: p.storage_path as string,
      caption: p.caption as string,
      width: p.width as number | null,
      height: p.height as number | null,
      position: p.position as number,
      url: galleryUrl(p.storage_path as string),
    }));
  },
  ["gallery-photos"],
  { tags: [EVENT_TAG], revalidate: 300 },
);

/** The event details. Falls back to built-in values (registration closed) if Supabase can't be reached. */
export async function getEventSettings(): Promise<EventSettings> {
  try {
    return await loadSettings();
  } catch (e) {
    console.error("event settings unavailable:", e instanceof Error ? e.message : e);
    return FALLBACK_SETTINGS;
  }
}

/** Additional details, in the order the admin set. */
export async function getEventDetails(): Promise<EventDetail[]> {
  try {
    return await loadDetails();
  } catch (e) {
    console.error("event details unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Gallery photos, in the order the admin set. */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    return await loadGallery();
  } catch (e) {
    console.error("gallery unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Public URL of a file in the gallery bucket. */
export function galleryUrl(path: string) {
  return `${supabaseUrl()}/storage/v1/object/public/gallery/${path.split("/").map(encodeURIComponent).join("/")}`;
}
