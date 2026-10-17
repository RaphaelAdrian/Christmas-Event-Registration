export const STATUSES = ["invited", "confirmed", "paid", "cancelled"] as const;

export type AttendeeStatus = (typeof STATUSES)[number];

/** The wording used everywhere: admin screens, filters and the Excel file. */
export const STATUS_LABELS: Record<AttendeeStatus, string> = {
  invited: "Invited – Not Confirmed",
  confirmed: "Confirmed – Will Join",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function isStatus(value: unknown): value is AttendeeStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function statusFromLabel(label: string): AttendeeStatus | null {
  const entry = Object.entries(STATUS_LABELS).find(([, l]) => l === label);
  return entry ? (entry[0] as AttendeeStatus) : null;
}

export type Attendee = {
  id: string;
  reference_code: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  name_as_entered: string | null;
  email: string | null;
  mobile: string | null;
  company: string | null;
  job_title: string | null;
  status: AttendeeStatus;
  payment_reference: string | null;
  receipt_path: string | null;
  invited_at: string | null;
  registered_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};
