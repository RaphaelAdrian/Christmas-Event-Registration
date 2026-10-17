import { event } from "@/config/event";
import { requireAdmin } from "@/lib/admin";
import { formatDateTimePH } from "@/lib/format";
import { STATUS_LABELS, type AttendeeStatus } from "@/lib/statuses";
import { AddInviteForm, ImportForm, InviteActions } from "./InviteForms";
import styles from "../../admin.module.css";

export default async function InvitesPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("attendees")
    .select("id, first_name, last_name, full_name, name_as_entered, email, status, invited_at")
    .not("invited_at", "is", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(5000);

  const rows = (data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    name_as_entered: string | null;
    email: string | null;
    status: AttendeeStatus;
    invited_at: string;
  }[];
  const waiting = rows.filter((r) => r.status === "invited").length;

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Invite list</h1>
        <p className={styles.pageNote}>
          {event.inviteOnly ? "Only people on this list can register. " : ""}
          A registration matches someone here when the last name is the same and the first name fits: &ldquo;Jai
          Plantig&rdquo; matches &ldquo;Jairus Miguel Plantig&rdquo;. Their status then changes from Invited to
          Confirmed, and a name that is already registered can&rsquo;t register again.
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
            An Excel (.xlsx) or CSV file with First name and Last name columns (Email is optional), or a single Name
            column. People already on the list are skipped.{" "}
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
                    <td className={styles.nameCell}>
                      <span className={styles.name}>{r.full_name || <span className={styles.muted}>No name</span>}</span>
                      {r.name_as_entered && r.name_as_entered.toLowerCase() !== r.full_name.toLowerCase() ? (
                        <span className={styles.sub}>Registered as {r.name_as_entered}</span>
                      ) : null}
                    </td>
                    <td>{r.email ?? <span className={styles.muted}>None</span>}</td>
                    <td>
                      <span className={styles.chip} data-status={r.status}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className={styles.nowrap}>{formatDateTimePH(r.invited_at)}</td>
                    <td>
                      <InviteActions
                        id={r.id}
                        firstName={r.first_name}
                        lastName={r.last_name}
                        email={r.email}
                        canRemove={r.status === "invited"}
                      />
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
