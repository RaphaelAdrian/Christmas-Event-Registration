import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminOrNull } from "@/lib/admin";
import { getEventSettings } from "@/lib/event";
import { LoginForm } from "./LoginForm";
import { signOut } from "./actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const admin = await adminOrNull();
  if (admin) redirect("/admin");

  const notAdmin = params.error === "not-admin";
  const event = await getEventSettings();

  return (
    <main id="main" className={`${styles.loginPage} theme-light`}>
      <div className={styles.loginPanel}>
        <p className={styles.loginEvent}>{event.shortName}</p>
        <h1 className={styles.loginTitle}>Admin sign in</h1>
        {notAdmin ? (
          <div className={styles.notice} role="alert">
            <p>You&rsquo;re signed in with an account that isn&rsquo;t on the admin list.</p>
            <form action={signOut}>
              <button type="submit" className="text-button">
                Sign out and use another account
              </button>
            </form>
          </div>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}
