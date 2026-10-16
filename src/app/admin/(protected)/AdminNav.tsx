"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";

const LINKS = [
  { href: "/admin", label: "Attendees" },
  { href: "/admin/invites", label: "Invite list" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className={styles.nav}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={styles.navLink} aria-current={pathname === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
