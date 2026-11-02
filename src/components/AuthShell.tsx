import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./AuthShell.module.css";

/** The frame for sign-in, password and My registration pages: a plain bar and one column. */
export function AuthShell({
  eventName,
  aside,
  children,
  wide = false,
}: {
  eventName: string;
  aside?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark}>
          {eventName}
        </Link>
        {aside}
      </header>
      <main id="main" className={wide ? `${styles.main} ${styles.wide}` : styles.main}>
        {children}
      </main>
    </div>
  );
}
