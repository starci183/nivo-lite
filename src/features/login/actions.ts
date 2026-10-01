"use server";

import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { login } from "@/i18n/dict/login";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Outcome } from "@/lib/types";

/** Local demo sign-in: env credentials, creating the account on first use, then redirects to the console. */
export const signInDemo = async (): Promise<Outcome<null>> => {
  const t = await getT(login);
  if (process.env.NEXT_PUBLIC_DEMO_LOGIN !== "1") return { ok: false, error: t("demoDisabled") };
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return { ok: false, error: t("demoNotConfigured") };
  const supabase = await supabaseServer();
  const first = await supabase.auth.signInWithPassword({ email, password });
  if (first.error) {
    // Confirmations are on: create the demo account already confirmed (service role, server only).
    const created = await supabaseAdmin().auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: process.env.DEMO_NAME || "An Nguyen" },
    });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) return { ok: false, error: created.error.message };
    const second = await supabase.auth.signInWithPassword({ email, password });
    if (second.error) return { ok: false, error: second.error.message };
  }
  redirect("/dashboard");
};
