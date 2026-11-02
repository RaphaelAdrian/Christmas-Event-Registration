"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allowed, TOO_MANY } from "@/lib/rate-limit";
import { safeNext } from "@/lib/site";
import { signInSchema } from "@/lib/validation";

export type SignInState = { error: string; email: string };

/** Guests sign in with the email and password they chose when they registered. */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const parsed = signInSchema.safeParse({ email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, email };
  if (!(await allowed("sign-in", 20))) return { error: TOO_MANY, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: "That email and password don't match. Forgot your password? Ask the organisers for a password link.",
      email,
    };
  }
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?signed-out=1");
}
