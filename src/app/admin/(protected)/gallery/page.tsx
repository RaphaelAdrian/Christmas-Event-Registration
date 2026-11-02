import { requireAdmin } from "@/lib/admin";
import { galleryUrl } from "@/lib/event";
import { GalleryManager } from "./GalleryManager";
import styles from "../../admin.module.css";

export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("gallery_photos")
    .select("id, storage_path, caption")
    .order("position")
    .order("created_at");
  const photos = (data ?? []).map((p) => ({
    id: p.id as string,
    caption: p.caption as string,
    url: galleryUrl(p.storage_path as string),
  }));

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Gallery</h1>
        <p className={styles.pageNote}>
          Venue photos for the public page. Anyone can see them, so use photos you&rsquo;re happy to share. Upload
          several at once; add a caption to say what each shows.
        </p>
      </div>
      {error ? <p className={styles.formError}>Couldn&rsquo;t load the gallery. Reload the page.</p> : null}
      <GalleryManager photos={photos} />
    </>
  );
}
