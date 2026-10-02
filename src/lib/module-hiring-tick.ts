import "server-only";
import {
  deleteCandidates, hdb, logCandidate, postOffice, type Db,
} from "./module-hiring-core";
import { closeJobIfFilled, drainHiring, notifyCandidate } from "./module-hiring-flow";
import { fmtVnDateTime, type CandidateRow, type InterviewRow, type JobRow, type SettingsRow } from "./module-hiring-shared";

/**
 * The hiring tick (pg_cron every 5 minutes -> /api/hiring/tick). One pass over every workspace that uses Hiring:
 *   - remind: a confirmed interview in the next 24 hours reminds the candidate (through the schedule_interview gate that created it) and the Office, once
 *   - offers: a sent offer past its date becomes "Hết hạn"
 *   - jobs: a job past its closing date is closed; a job with enough hires is closed when the shop asked for it
 *   - retention: rejected and withdrawn candidates older than the shop's retention (default 90 days) are deleted, CV files included
 *   - queue: screening steps still waiting in the engine queue run now
 * Idempotent: every step marks what it did.
 */
export type TickResult = { workspaces: number; reminders: number; offersExpired: number; jobsClosed: number; deletedCandidates: number; deletedFiles: number; drained: number };

const reminders = async (db: Db, s: SettingsRow): Promise<number> => {
  if (!s.remind_interview) return 0;
  const now = new Date();
  const rows = ((await db.from("hiring_interviews").select("*").eq("workspace_id", s.workspace_id).eq("status", "confirmed").is("reminder_sent_at", null)
    .gte("slot_start", now.toISOString()).lte("slot_start", new Date(now.getTime() + 24 * 3_600_000).toISOString())).data ?? []) as Array<InterviewRow>;
  let n = 0;
  for (const iv of rows) {
    const claim = await db.from("hiring_interviews").update({ reminder_sent_at: now.toISOString() }).eq("id", iv.id).is("reminder_sent_at", null).select("id").maybeSingle();
    if (!claim.data) continue;
    const cand = (await db.from("hiring_candidates").select("*").eq("id", iv.candidate_id).maybeSingle()).data as CandidateRow | null;
    const job = (await db.from("hiring_jobs").select("title").eq("id", iv.job_id).maybeSingle()).data as Pick<JobRow, "title"> | null;
    if (!cand || !iv.slot_start) continue;
    const when = fmtVnDateTime(iv.slot_start);
    let note = "";
    if (iv.work_item_id) {
      const d = await notifyCandidate(db, s.workspace_id, cand, {
        subject: `Nhắc lịch phỏng vấn: ${job?.title ?? ""}`, workItemId: iv.work_item_id,
        text: `Chào ${cand.name}, nhắc bạn lịch phỏng vấn "${job?.title ?? ""}" lúc ${when}${iv.location ? ` (${iv.location})` : ""}. Nếu cần đổi giờ, bạn nhắn lại sớm giúp bên mình nhé.`,
      });
      note = d.note;
    }
    await logCandidate(db, s.workspace_id, cand.id, "interview_reminder", "NIVO", `Nhắc phỏng vấn lúc ${when}. ${note}`);
    await postOffice(db, s.workspace_id, `Nhắc: phỏng vấn ${cand.name} ("${job?.title ?? ""}") lúc ${when}${iv.interviewer_name ? ` với ${iv.interviewer_name}` : ""}.`);
    n += 1;
  }
  return n;
};

const expireOffers = async (db: Db, ws: string): Promise<number> => {
  const { data } = await db.from("hiring_offers").update({ status: "expired" }).eq("workspace_id", ws).eq("status", "sent").lt("expires_at", new Date().toISOString()).select("id, candidate_id");
  for (const o of (data ?? []) as Array<{ candidate_id: string }>) await logCandidate(db, ws, o.candidate_id, "offer_expired", "NIVO", "Thư mời đã hết hạn");
  return (data ?? []).length;
};

const sweepJobs = async (db: Db, ws: string): Promise<number> => {
  let closed = 0;
  const now = new Date().toISOString();
  const expired = ((await db.from("hiring_jobs").update({ status: "closed", updated_at: now }).eq("workspace_id", ws).in("status", ["open", "paused"]).lt("closes_at", now).select("title")).data ?? []) as Array<{ title: string }>;
  for (const j of expired) await postOffice(db, ws, `Tin "${j.title}" đã hết hạn nhận hồ sơ nên NIVO đã đóng tin.`);
  closed += expired.length;
  const open = ((await db.from("hiring_jobs").select("id").eq("workspace_id", ws).in("status", ["open", "paused"])).data ?? []) as Array<{ id: string }>;
  for (const j of open) if (await closeJobIfFilled(db, ws, j.id)) closed += 1;
  return closed;
};

/** Delete the candidates the retention period has run out for. Logged per workspace (counts only: no personal data stays). */
export const runRetention = async (db: Db, s: Pick<SettingsRow, "workspace_id" | "retention_days">): Promise<{ candidates: number; files: number }> => {
  const cutoff = new Date(Date.now() - s.retention_days * 86_400_000).toISOString();
  const due = ((await db.from("hiring_candidates").select("id").eq("workspace_id", s.workspace_id).in("stage", ["rejected", "withdrawn"]).lt("stage_changed_at", cutoff).limit(200)).data ?? []) as Array<{ id: string }>;
  if (!due.length) return { candidates: 0, files: 0 };
  const r = await deleteCandidates(db, s.workspace_id, due.map((d) => d.id));
  await db.from("hiring_retention_log").insert({ workspace_id: s.workspace_id, deleted_candidates: r.candidates, deleted_files: r.files, retention_days: s.retention_days });
  return r;
};

export const runHiringTick = async (): Promise<TickResult> => {
  const db = hdb();
  const out: TickResult = { workspaces: 0, reminders: 0, offersExpired: 0, jobsClosed: 0, deletedCandidates: 0, deletedFiles: 0, drained: 0 };
  const all = ((await db.from("hiring_settings").select("*")).data ?? []) as Array<SettingsRow>;
  for (const s of all) {
    out.workspaces += 1;
    try {
      out.reminders += await reminders(db, s);
      out.offersExpired += await expireOffers(db, s.workspace_id);
      out.jobsClosed += await sweepJobs(db, s.workspace_id);
      const r = await runRetention(db, s);
      out.deletedCandidates += r.candidates;
      out.deletedFiles += r.files;
      const queued = await db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", s.workspace_id).eq("department", "hiring").eq("status", "queued");
      if ((queued.count ?? 0) > 0) out.drained += await drainHiring(s.workspace_id, 3);
    } catch (e) {
      console.error("hiring tick failed for a workspace:", e instanceof Error ? e.message : e);
    }
  }
  return out;
};
