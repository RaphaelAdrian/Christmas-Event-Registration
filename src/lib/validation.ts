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

/** Turns "0917-123-4567" or "+63 917 123 4567" into "+63 917 123 4567". Returns null when it is not a usable number. */
export function normalizeMobile(input: string): string | null {
  const raw = input.replace(/[\s\-().]/g, "");
  let digits = raw;
  if (/^09\d{9}$/.test(digits)) digits = "63" + digits.slice(1);
  else if (/^\+639\d{9}$/.test(digits)) digits = digits.slice(1);
  else if (/^639\d{9}$/.test(digits)) digits = digits;
  else if (/^9\d{9}$/.test(digits)) digits = "63" + digits;
  else if (/^\+\d{8,15}$/.test(raw)) return raw; // international number, keep as typed
  else return null;
  return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

const mustTick = (message: string) => z.boolean().refine((v) => v === true, { message });

export const detailsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Enter your full name." })
    .max(100, { message: "Use 100 characters or fewer." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: "Enter your email address." })
    .max(254, { message: "That email address is too long." })
    .email({ message: "Enter an email address like name@company.com." }),
  mobile: z
    .string()
    .trim()
    .min(1, { message: "Enter your mobile number." })
    .refine((v) => normalizeMobile(v) !== null, { message: "Enter a mobile number like 0917 123 4567." })
    .transform((v) => normalizeMobile(v) as string),
  company: z
    .string()
    .trim()
    .min(2, { message: "Enter your company or organisation." })
    .max(150, { message: "Use 150 characters or fewer." }),
  jobTitle: z.string().trim().max(100, { message: "Use 100 characters or fewer." }).optional().default(""),
});

export const instructionsSchema = z.object({
  instructionsAck: mustTick("Tick the box to confirm you have read the event instructions."),
});

export const termsSchema = z.object({
  termsAccepted: mustTick("Tick the box to agree to the terms and conditions."),
  privacyConsent: mustTick("Tick the box to give your consent under the Data Privacy Act of 2012."),
});

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
    .regex(/^\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|heif|pdf)$/, {
      message: "Upload your receipt again.",
    }),
});

export const registrationSchema = detailsSchema
  .merge(instructionsSchema)
  .merge(termsSchema)
  .merge(paymentSchema);

export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

/** The schema for each step of the form, in order. Step 5 (review) checks everything. */
export const stepSchemas = [detailsSchema, instructionsSchema, termsSchema, paymentSchema, registrationSchema] as const;

/** Which step a field belongs to (0-based), so errors can send people back to the right place. */
export const FIELD_STEP: Record<string, number> = {
  fullName: 0,
  email: 0,
  mobile: 0,
  company: 0,
  jobTitle: 0,
  instructionsAck: 1,
  termsAccepted: 2,
  privacyConsent: 2,
  paymentReference: 3,
  receiptPath: 3,
};

export function receiptFileProblem(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES[file.type]) return "Choose a JPG, PNG, WEBP or HEIC image, or a PDF.";
  if (file.size > RECEIPT_MAX_BYTES) return "That file is over 5 MB. Take a screenshot instead, or reduce the photo size.";
  if (file.size === 0) return "That file is empty. Choose the receipt again.";
  return null;
}

export const inviteSchema = z.object({
  fullName: z.string().trim().max(100, { message: "Use 100 characters or fewer." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: "Enter an email address." })
    .max(254, { message: "That email address is too long." })
    .email({ message: "Enter an email address like name@company.com." }),
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
