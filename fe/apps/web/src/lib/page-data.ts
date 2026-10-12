import "server-only";
import { cache } from "react";
import { FOUNDING_OFFER } from "./promo";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { GovernanceRows } from "./flow-queries";
import type { PromoRaw } from "@/features/promo/queries";
import type { Agent, EventRow, Message, ResponsibilityWithLead } from "./types";

/**
 * One request per heavy page. Each SQL function (`dashboard_data`, `office_data`) returns the rows the page used to read with 7-12 separate
 * requests (same columns, order and limits), under the caller's RLS. The pages shape them with the same helpers the single readers use, so
 * what is drawn does not change. A failed call returns null and the page falls back to its separate reads (e.g. before a migration is applied).
 */
const DAY = 86_400_000;

export type DashboardData = {
  since7: string;
  responsibilities: Array<ResponsibilityWithLead>;
  agents: Array<Agent>;
  events: Array<EventRow>;
  leads: Array<{ id: string; stage: "new" | "qualified" | "proposal" | "won" | "lost"; created_at: string; contact_name: string | null; company: string | null }>;
  pending: Array<{ id: string; responsibility_id: string; created_at: string; lead_id: string | null }>;
  promo: PromoRaw;
  governance: GovernanceRows;
  exceptions: Array<unknown>;
};

export const getDashboardData = cache(async (): Promise<DashboardData | null> => {
  const session = await getSession();
  const db = await supabaseServer();
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();
  const { data, error } = await db.rpc("dashboard_data", {
    ws: session.workspace.id, since7, founding_from: FOUNDING_OFFER.startsAt, founding_to: FOUNDING_OFFER.endsAt,
  });
  if (error || !data) {
    console.error("dashboard_data failed, reading page data one by one:", error?.message ?? "empty");
    return null;
  }
  return { ...(data as Omit<DashboardData, "since7">), since7 };
});

export type OfficeData = {
  since7: string;
  messages: Array<Message>;
  agents: Array<Agent>;
  responsibilities: Array<ResponsibilityWithLead>;
  pending: Array<unknown>;
  decided: Array<unknown>;
  leads: Array<unknown>;
  open_responsibilities: Array<{ lead_id: string; owner_name: string | null; next_action: string | null; status: string }>;
  exceptions: Array<unknown>;
  recent_items: Array<unknown>;
  governance: GovernanceRows;
  staff: Array<unknown>;
  members: Array<{ user_id: string; role: "owner" | "manager" | "staff"; staff_id: string | null; display_name: string; status: "active" | "disabled"; email: string | null; last_sign_in_at: string | null }>;
};

export const getOfficeData = cache(async (): Promise<OfficeData | null> => {
  const session = await getSession();
  const db = await supabaseServer();
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();
  const { data, error } = await db.rpc("office_data", { ws: session.workspace.id, since7 });
  if (error || !data) {
    console.error("office_data failed, reading page data one by one:", error?.message ?? "empty");
    return null;
  }
  return { ...(data as Omit<OfficeData, "since7">), since7 };
});
