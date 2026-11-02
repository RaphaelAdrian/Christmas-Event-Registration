"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/registrants", label: "Registrants" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/invites", label: "Invite list" },
  { href: "/admin/event", label: "Event details" },
  { href: "/admin/gallery", label: "Gallery" },
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
