import "server-only";
import { renderEmail } from "./email/layout";
import { sendWorkspaceEmail } from "./email/send";
import { supabaseAdmin } from "./supabase/admin";

/** The monthly summary goes to the owner (an owner-facing notice, not a customer message) with the CSV attached. True only when the mail was sent. */
export const sendWorkspaceEmailSafe = async (o: { workspaceId: string; to: string; subject: string; text: string; csvName: string; csv: string }): Promise<boolean> => {
  try {
    const shop = ((await supabaseAdmin().from("workspaces").select("name").eq("id", o.workspaceId).maybeSingle()).data as { name?: string } | null)?.name ?? "NIVO";
    const mail = renderEmail({ shopName: shop, title: o.subject, body: o.text });
    const r = await sendWorkspaceEmail({
      workspaceId: o.workspaceId, to: o.to, subject: o.subject, html: mail.html, text: mail.text, purpose: "shifts_month_close", audience: "owner",
      attachments: [{ filename: o.csvName, content: `﻿${o.csv}`, contentType: "text/csv; charset=utf-8", encoding: "utf8" }],
    });
    return r.status === "sent";
  } catch (e) {
    console.error("shifts payroll mail failed:", e instanceof Error ? e.message : e);
    return false;
  }
};

