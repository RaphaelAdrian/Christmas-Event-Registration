"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, newPasswordSchema } from "@/lib/validation";

export type PasswordState = { error: string; fieldErrors: Record<string, string> };

/** Saves the password for the signed-in person (they arrive here from the invite or reset link). */
export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { error: "", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const weak = /weak|short|password/i.test(error.message) && error.status === 422;
    return {
      error: weak
        ? "Choose a stronger password: longer, and not one you use elsewhere."
        : "We couldn't save your password. Try again in a minute.",
      fieldErrors: {},
    };
  }
  redirect("/account?welcome=1");
}
