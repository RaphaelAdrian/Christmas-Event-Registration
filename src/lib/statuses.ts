/** Registration: invited (invite list only) → pending → approved or declined. */
export const REGISTRATION_STATUSES = ["invited", "pending", "approved", "declined"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Payment: unpaid → submitted → paid, or rejected (the person can submit again). */
export const PAYMENT_STATUSES = ["unpaid", "submitted", "paid", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** The wording used everywhere: admin screens, filters, the registrant's page and the Excel file. */
export const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
  invited: "Invited – Not registered",
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  submitted: "Payment Submitted",
  paid: "Paid",
  rejected: "Rejected",
};

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string" && (REGISTRATION_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export type Attendee = {
  id: string;
  reference_code: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  name_as_entered: string | null;
  email: string | null;
  company: string | null;
  registration_status: RegistrationStatus;
  payment_status: PaymentStatus;
  user_id: string | null;
  invited_at: string | null;
  registered_at: string | null;
  approved_at: string | null;
  declined_at: string | null;
  paid_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export const ATTENDEE_COLUMNS =
  "id, reference_code, first_name, last_name, full_name, name_as_entered, email, company, registration_status, payment_status, user_id, invited_at, registered_at, approved_at, declined_at, paid_at, reviewed_by, created_at";

export type PaymentSubmission = {
  id: string;
  attendee_id: string;
  reference: string;
  reference_key: string;
  /** None for a payment an admin received directly */
  receipt_path: string | null;
  amount: number | null;
  status: "submitted" | "paid" | "rejected";
  /** online: sent through the site with a receipt; direct: paid to an organiser and marked by an admin */
  method: "online" | "direct";
  reject_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export const SUBMISSION_COLUMNS =
  "id, attendee_id, reference, reference_key, receipt_path, amount, status, method, reject_reason, submitted_at, reviewed_at, reviewed_by";
