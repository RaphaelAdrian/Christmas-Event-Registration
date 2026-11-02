"use server";

import { getEventSettings } from "@/lib/event";
import { allowed, TOO_MANY } from "@/lib/rate-limit";
import { outcomeMessage } from "@/lib/registrant";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { FIELD_STEP, fieldErrors, nameSchema, contactSchema, registrationSchema } from "@/lib/validation";

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string>; step?: number };

const CLOSED: Failure = { ok: false, error: "Registration is closed." };
const CHECK_FAILED = "We couldn't check the invite list just now. Try again in a minute.";

/**
 * Steps 1 and 2: check the name against the invite list, and (once it is
 * typed) the email against existing registrations, before the person goes on.
 * The final submit repeats the same check inside the database.
 */
export async function checkRegistrant(input: {
  firstName: string;
  lastName: string;
  email?: string;
}): Promise<{ ok: true } | Failure> {
  const event = await getEventSettings();
  if (!event.registrationOpen) return CLOSED;

  const name = nameSchema.safeParse(input);
  if (!name.success) {
    return { ok: false, error: "Some details need fixing.", fieldErrors: fieldErrors(name.error), step: 0 };
  }
  let email = "";
  if (input.email !== undefined) {
    const contact = contactSchema.pick({ email: true }).safeParse({ email: input.email });
    if (!contact.success) {
      return { ok: false, error: "Some details need fixing.", fieldErrors: fieldErrors(contact.error), step: 1 };
    }
    email = contact.data.email;
  }
  if (!(await allowed("check-name", 40))) return { ok: false, error: TOO_MANY };

  const { data, error } = await createServiceClient().rpc("resolve_registrant", {
    p_first_name: name.data.firstName,
    p_last_name: name.data.lastName,
    p_email: email,
    p_invite_only: event.inviteOnly,
  });
  if (error) {
    console.error("invite check failed", error.message);
    return { ok: false, error: CHECK_FAILED };
  }
  const outcome = String((Array.isArray(data) ? data[0] : data)?.outcome ?? "");
  if (outcome === "INVITED" || outcome === "NEW") return { ok: true };

  const problem = outcomeMessage(outcome, event.contactEmail);
  if (!problem) return { ok: false, error: CHECK_FAILED };
  return {
    ok: false,
    error: problem.message,
    fieldErrors: { [problem.field]: problem.message },
    step: FIELD_STEP[problem.field] ?? 0,
  };
}

/** Turns a database outcome code into a message under the right field, or null when it isn't one. */
function outcomeFailure(code: string, contactEmail: string): Failure | null {
  const problem = outcomeMessage(code, contactEmail);
  if (problem) {
    return { ok: false, error: problem.message, fieldErrors: { [problem.field]: problem.message }, step: FIELD_STEP[problem.field] ?? 0 };
  }
  if (code === "REGISTRATION_CLOSED") return CLOSED;
  if (code === "INVALID_EMAIL") {
    const message = "Enter an email address like name@company.com.";
    return { ok: false, error: message, fieldErrors: { email: message }, step: 1 };
  }
  return null;
}

const SAVE_FAILED: Failure = { ok: false, error: "We couldn't save your registration. Try again in a minute." };

/**
 * Last step: validate everything again, create the guest's login with the
 * password they chose (Supabase Auth stores it hashed), save the registration
 * as Pending, link the two, and sign them in on this browser.
 */
export async function submitRegistration(
  input: Record<string, unknown>,
  guard: { website: string; startedAt: number },
): Promise<{ ok: true; referenceCode: string } | Failure> {
  const event = await getEventSettings();
  if (!event.registrationOpen) return CLOSED;

  // Spam protection: the hidden "website" field must stay empty, and a person
  // needs more than a few seconds to fill in four steps.
  const tooFast = !Number.isFinite(guard.startedAt) || Date.now() - guard.startedAt < 3000;
  if (guard.website.trim() !== "" || tooFast) {
    return { ok: false, error: "We couldn't submit your registration. Reload the page and try again." };
  }

  if (!(await allowed("submit", 6))) return { ok: false, error: TOO_MANY };

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    const step = Math.min(...Object.keys(errors).map((k) => FIELD_STEP[k] ?? 3));
    return { ok: false, error: "Some details need fixing.", fieldErrors: errors, step };
  }
  const r = parsed.data;
  const service = createServiceClient();

  // 1. The invite-list and duplicate checks, before anyone gets a login
  const { data: check, error: checkError } = await service.rpc("resolve_registrant", {
    p_first_name: r.firstName,
    p_last_name: r.lastName,
    p_email: r.email,
    p_invite_only: event.inviteOnly,
  });
  if (checkError) {
    console.error("invite check failed", checkError.message);
    return { ok: false, error: CHECK_FAILED };
  }
  const outcome = String((Array.isArray(check) ? check[0] : check)?.outcome ?? "");
  if (outcome !== "INVITED" && outcome !== "NEW") return outcomeFailure(outcome, event.contactEmail) ?? SAVE_FAILED;

  // 2. The login
  let userId: string;
  let createdNow = false;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: r.email,
    password: r.password,
    email_confirm: true,
    user_metadata: { first_name: r.firstName, last_name: r.lastName },
  });
  if (created?.user) {
    userId = created.user.id;
    createdNow = true;
  } else if (createError?.code === "weak_password") {
    const message = "Choose a stronger password: longer, and not one you use elsewhere.";
    return { ok: false, error: message, fieldErrors: { password: message }, step: 2 };
  } else {
    // The email already has a login (an admin's, say): accept it only with its own password
    const { data: existing } = await service.rpc("auth_user_id", { p_email: r.email });
    if (typeof existing !== "string" || !existing) {
      console.error("create login failed", createError?.message);
      return SAVE_FAILED;
    }
    const { data: probe, error: probeError } = await createPublicClient().auth.signInWithPassword({
      email: r.email,
      password: r.password,
    });
    if (probeError || !probe.user) {
      const message = "This email already has a sign-in. Use the password you set for it.";
      return { ok: false, error: message, fieldErrors: { password: message }, step: 2 };
    }
    userId = probe.user.id;
  }

  // 3. The registration (the database repeats every check)
  const { data, error } = await service.rpc("register_attendee", {
    p_first_name: r.firstName,
    p_last_name: r.lastName,
    p_email: r.email,
    p_company: r.company,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.reference_code) {
    if (createdNow) await service.auth.admin.deleteUser(userId);
    if (error) {
      const known = outcomeFailure(error.message, event.contactEmail);
      if (known) return known;
      console.error("register_attendee failed", error.message);
    }
    return SAVE_FAILED;
  }

  // 4. Link the login to the registration, then sign them in here
  const { error: linkError } = await service.from("attendees").update({ user_id: userId }).eq("email", r.email);
  if (linkError) console.error("link login failed", linkError.message);
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: r.email, password: r.password });

  return { ok: true, referenceCode: row.reference_code as string };
}
