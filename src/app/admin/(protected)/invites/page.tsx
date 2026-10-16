import { requireAdmin } from "@/lib/admin";
import { formatDateTimePH } from "@/lib/format";
import { STATUS_LABELS, type AttendeeStatus } from "@/lib/statuses";
import { AddInviteForm, ImportForm, InviteActions } from "./InviteForms";
import styles from "../../admin.module.css";

export default async function InvitesPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("attendees")
    .select("id, full_name, email, status, invited_at")
    .not("invited_at", "is", null)
    .order("invited_at", { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as { id: string; full_name: string; email: string; status: AttendeeStatus; invited_at: string }[];
  const waiting = rows.filter((r) => r.status === "invited").length;

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Invite list</h1>
        <p className={styles.pageNote}>
          When an invited person registers with the same email, their status changes from Invited to Confirmed by
          itself. Send each person their own invite link so the form opens with their email filled in.
        </p>
      </div>

      <div className={styles.inviteForms}>
        <section aria-labelledby="add-heading" className={styles.formBlock}>
          <h2 id="add-heading" className={styles.blockTitle}>
            Add a person
          </h2>
          <AddInviteForm />
        </section>
        <section aria-labelledby="import-heading" className={styles.formBlock}>
          <h2 id="import-heading" className={styles.blockTitle}>
            Import a list
          </h2>
          <p className={styles.blockNote}>
            An Excel (.xlsx) or CSV file with a Name column and an Email column. People already on the list are skipped.{" "}
            <a href="/admin/invites-template" download>
              Download a CSV template
            </a>
            .
          </p>
          <ImportForm />
        </section>
      </div>

      <section className={styles.tableSection} aria-labelledby="invitees-heading">
        <h2 id="invitees-heading" className={styles.blockTitle}>
          {rows.length} invited, {waiting} not registered yet
        </h2>
        {error ? <p className={styles.formError}>Couldn&rsquo;t load the invite list. Reload the page.</p> : null}
        {rows.length ? (
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Invite list, scrolls sideways">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Invited</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.name}>{r.full_name || <span className={styles.muted}>No name</span>}</td>
                    <td>{r.email}</td>
                    <td>
                      <span className={styles.chip} data-status={r.status}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className={styles.nowrap}>{formatDateTimePH(r.invited_at)}</td>
                    <td>
                      <InviteActions id={r.id} name={r.full_name} email={r.email} canRemove={r.status === "invited"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>No one on the invite list yet. Add people one by one or import a file above.</p>
          </div>
        )}
      </section>
    </>
  );
}
