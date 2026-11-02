import { z } from "zod";

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

const mustTick = (message: string) => z.boolean().refine((v) => v === true, { message });

const firstName = z
  .string()
  .trim()
  .min(1, { message: "Enter your first name." })
  .max(100, { message: "Use 100 characters or fewer." });
const lastName = z
  .string()
  .trim()
  .min(1, { message: "Enter your last name." })
  .max(100, { message: "Use 100 characters or fewer." });
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: "Enter your email address." })
  .max(254, { message: "That email address is too long." })
  .email({ message: "Enter an email address like name@company.com." });

/** Registration, step 1: the name (checked against the invite list). */
export const nameSchema = z.object({ firstName, lastName });

/** Registration, step 2: where we send the approval email, and the company for the pass. */
export const contactSchema = z.object({
  email,
  company: z
    .string()
    .trim()
    .min(2, { message: "Enter your company or organisation." })
    .max(150, { message: "Use 150 characters or fewer." }),
});

/** A new password, typed twice. Supabase Auth stores it hashed. */
const passwordFields = z.object({
  password: z
    .string()
    .min(7, { message: "Use at least 7 characters." })
    .max(72, { message: "Use 72 characters or fewer." }),
  confirm: z.string(),
});
const passwordsMatch = (v: { password: string; confirm: string }) => v.password === v.confirm;
const MISMATCH = { message: "The two passwords don't match.", path: ["confirm"] };

/** Registration, step 3 (and the set-password page): the password the guest signs in with. */
export const newPasswordSchema = passwordFields.refine(passwordsMatch, MISMATCH);

/** Registration, step 4: consent under the Data Privacy Act. */
export const consentSchema = z.object({
  consent: mustTick("Tick the box to agree to the terms and the privacy notice."),
});

export const registrationSchema = nameSchema
  .merge(contactSchema)
  .merge(passwordFields)
  .merge(consentSchema)
  .refine(passwordsMatch, MISMATCH);

export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

/** The schema for each step of the form, in order. The last step checks everything. */
export const stepSchemas = [nameSchema, contactSchema, newPasswordSchema, registrationSchema] as const;

/** Which step a field belongs to (0-based), so errors can send people back to the right place. */
export const FIELD_STEP: Record<string, number> = {
  firstName: 0,
  lastName: 0,
  email: 1,
  company: 1,
  password: 2,
  confirm: 2,
  consent: 3,
};

/** Signing in (registrants and admins). */
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Enter the email address you registered with." }),
  password: z.string().min(1, { message: "Enter your password." }),
});

/** A payment: the reference number from the receipt, and the uploaded receipt. */
export const paymentSchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .min(4, { message: "Enter the reference number shown on your receipt." })
    .max(64, { message: "Use 64 characters or fewer." })
    .regex(/^[A-Za-z0-9][A-Za-z0-9 \-/#.]*$/, {
      message: "Use letters, numbers, spaces and dashes only.",
    }),
  receiptPath: z
    .string()
    .min(1, { message: "Upload a screenshot or photo of your receipt." })
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|heif|pdf)$/, {
      message: "Upload your receipt again.",
    }),
});

export function receiptFileProblem(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES[file.type]) return "Choose a JPG, PNG, WEBP or HEIC image, or a PDF.";
  if (file.size > RECEIPT_MAX_BYTES) return "That file is over 5 MB. Take a screenshot instead, or reduce the photo size.";
  if (file.size === 0) return "That file is empty. Choose the receipt again.";
  return null;
}

/** One person on the invite list: first and last name required, email optional. */
export const inviteSchema = z.object({
  firstName,
  lastName,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, { message: "That email address is too long." })
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter an email address like name@company.com, or leave it empty.",
    }),
});

/** Flatten zod issues into { field: message } (first message per field). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Admin: the Event details form. Dates and times are Philippine time. */
export const eventSettingsSchema = z.object({
  name: z.string().trim().min(1, { message: "Enter the event name." }).max(120),
  shortName: z.string().trim().min(1, { message: "Enter a short name." }).max(60),
  tagline: z.string().trim().max(300).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Pick the date." }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Pick the start time." }),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Pick the end time." }),
  venueName: z.string().trim().min(1, { message: "Enter the venue." }).max(150),
  venueAddress: z.string().trim().max(300).default(""),
  mapUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), { message: "Paste a link that starts with https://, or leave it empty." }),
  callTime: z.string().trim().max(60).default(""),
  shuttleInfo: z.string().trim().max(500).default(""),
  organizer: z.string().trim().max(150).default(""),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, { message: "Enter an email address, or leave it empty." }),
  referencePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, { message: "Use 1 to 10 capital letters or digits, like EMC." }),
  registrationOpen: z.boolean(),
  inviteOnly: z.boolean(),
  terms: z.string().max(10000).default(""),
  privacyNotice: z.string().max(10000).default(""),
});

export type EventSettingsInput = z.input<typeof eventSettingsSchema>;

/** Admin: one additional detail (title and text). */
export const detailSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, { message: "Give each detail a title." }).max(120, { message: "Use 120 characters or fewer." }),
  body: z.string().trim().max(3000, { message: "Use 3,000 characters or fewer." }).default(""),
});

/** Admin: the payment amount and instructions. */
export const paymentSettingsSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter the amount in pesos." })
    .positive({ message: "Enter an amount above zero." })
    .max(1_000_000, { message: "That amount looks too large." }),
  instructions: z.string().trim().max(3000, { message: "Use 3,000 characters or fewer." }).default(""),
});

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
