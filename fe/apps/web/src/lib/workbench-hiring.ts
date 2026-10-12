import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, instantOf, mondayOf, todayVn } from "./module-shifts-types";

/**
 * Hiring workbench figures (read side), the four numbers of the agent dashboard ribbon, counted in the database
 * (the workbench lists are capped, a count is not). Reads hiring_jobs, hiring_candidates, hiring_interviews, hiring_offers.
 */
type Db = SupabaseClient;

/** Stages of a candidate still moving through the pipeline, from "applied" up to the offer; hired, rejected and withdrawn are closed. */
export const PIPELINE_STAGES: ReadonlyArray<string> = ["applied", "screening", "shortlisted", "interview", "offer"];

export type HiringFigures = {
  readonly openRoles: number;
  readonly totalRoles: number;
  readonly pipeline: number;
  /** Interviews the candidate confirmed with a slot from Monday to Sunday of this week (Vietnam time). */
  readonly interviewsWeek: number;
  /** Offers not answered yet: waiting for the manager's approval, and sent and waiting for the candidate. */
  readonly offersWaiting: number;
  readonly offersSent: number;
};

const head = (db: Db, table: string, ws: string) => db.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", ws);

export const getHiringFigures = async (db: Db, ws: string): Promise<HiringFigures> => {
  const monday = mondayOf(todayVn());
  const from = instantOf(monday, 0).toISOString();
  const to = instantOf(addDays(monday, 7), 0).toISOString();
  const [open, all, pipeline, interviews, waiting, sent] = await Promise.all([
    head(db, "hiring_jobs", ws).eq("status", "open"),
    head(db, "hiring_jobs", ws),
    head(db, "hiring_candidates", ws).in("stage", [...PIPELINE_STAGES]),
    head(db, "hiring_interviews", ws).eq("status", "confirmed").gte("slot_start", from).lt("slot_start", to),
    head(db, "hiring_offers", ws).eq("status", "waiting"),
    head(db, "hiring_offers", ws).eq("status", "sent"),
  ]);
  for (const r of [open, all, pipeline, interviews, waiting, sent]) if (r.error) throw new Error(r.error.message);
  return {
    openRoles: open.count ?? 0, totalRoles: all.count ?? 0, pipeline: pipeline.count ?? 0,
    interviewsWeek: interviews.count ?? 0, offersWaiting: waiting.count ?? 0, offersSent: sent.count ?? 0,
  };
};
