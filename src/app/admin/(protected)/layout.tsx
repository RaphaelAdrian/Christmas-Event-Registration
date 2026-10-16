import type { ReactNode } from "react";
import type { Metadata } from "next";
import { event } from "@/config/event";
import { requireAdmin } from "@/lib/admin";
import { signOut } from "../login/actions";
import { AdminNav } from "./AdminNav";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <div className={styles.shell}>
      <header className={`${styles.header} on-dark`}>
        <div className={styles.brand}>
          <span className={styles.brandName}>{event.shortName}</span>
          <span className={styles.brandRole}>Admin</span>
        </div>
        <AdminNav />
        <div className={styles.headerActions}>
          <a href="/admin/export" className="btn btn-small" download>
            Download Excel
          </a>
          <form action={signOut}>
            <button type="submit" className={styles.signOut} title={user.email ?? undefined}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
