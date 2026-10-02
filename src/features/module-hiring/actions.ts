"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { isManagerRole } from "@/lib/members-shared";
import {
  HiringError, cvSignedUrl, deleteCandidates, generateJobAd, hdb, loadCandidate, logCandidate, moveCandidate, saveJob, saveNotes, saveSettings, setJobStatus,
  type AdResult, type JobInput, type SettingsInput,
} from "@/lib/module-hiring-core";
import {
  drainHiring, requestInterview, requestOffer, setInterviewStatus, startScreening, type OfferRequest,
} from "@/lib/module-hiring-flow";
import type { FairnessViolation, JobStatus, Stage } from "@/lib/module-hiring-shared";
import type { WorkItem } from "@/lib/flow-types";

/**
 * Hiring workbench commands. Every command checks that the signed-in person is the owner or a manager, takes the workspace from the SESSION (never from
 * the client), and answers { ok, data } or { ok: false, error } in plain Vietnamese. Anything that talks to a candidate goes through the authority gate.
 */
export type Result<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string; readonly violations?: ReadonlyArray<FairnessViolation> };

const run = async <T>(fn: (c: { ws: string; userId: string; name: string }) => Promise<T>): Promise<Result<T>> => {
  try {
    const s = await getSession();
    if (!isManagerRole(s.member.role)) return { ok: false, error: "Chỉ chủ hoặc quản lý mới dùng được Tuyển dụng." };
    const data = await fn({ ws: s.workspace.id, userId: s.userId, name: s.userName });
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof HiringError) return { ok: false, error: e.message, violations: e.violations };
    console.error("hiring action failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export type ItemOutcome = { readonly status: WorkItem["status"]; readonly summary: string; readonly error: string | null };
const outcomeOf = (i: WorkItem): ItemOutcome => ({ status: i.status, summary: i.result?.summary ?? i.proposal.summary, error: i.error });

/* ------------------------------------------------------------------ jobs */

export async function saveJobAction(input: JobInput): Promise<Result<{ id: string; slug: string }>> {
  return run(async (c) => {
    const j = await saveJob(hdb(), c.ws, c.userId, input);
    return { id: j.id, slug: j.slug };
  });
}

export async function setJobStatusAction(id: string, status: JobStatus): Promise<Result<{ status: JobStatus }>> {
  return run(async (c) => ({ status: (await setJobStatus(hdb(), c.ws, id, status)).status }));
}

export type AdOutcome = { readonly ads: AdResult["ads"]; readonly attempts: number; readonly sanitised: boolean; readonly timings: Record<string, number> };
export async function generateAdAction(jobId: string): Promise<Result<AdOutcome>> {
  return run(async (c) => {
    const r = await generateJobAd(hdb(), c.ws, jobId);
    return { ads: r.ads, attempts: r.attempts, sanitised: r.sanitised, timings: r.timings };
  });
}

/* ------------------------------------------------------------------ candidates */

export async function moveCandidateAction(id: string, stage: Stage, reason?: string): Promise<Result<{ stage: Stage }>> {
  return run(async (c) => ({ stage: (await moveCandidate(hdb(), c.ws, id, stage, c.name, reason)).stage }));
}

export async function saveNotesAction(id: string, notes: string): Promise<Result<null>> {
  return run(async (c) => {
    await saveNotes(hdb(), c.ws, id, notes, c.name);
    return null;
  });
}

export async function deleteCandidateAction(id: string): Promise<Result<{ files: number }>> {
  return run(async (c) => {
    await loadCandidate(hdb(), c.ws, id);
    const r = await deleteCandidates(hdb(), c.ws, [id]);
    return { files: r.files };
  });
}

export async function rescreenAction(id: string): Promise<Result<ItemOutcome>> {
  return run(async (c) => {
    await loadCandidate(hdb(), c.ws, id);
    const item = await startScreening(c.ws, id, { again: true });
    await drainHiring(c.ws, 2);
    const done = (await hdb().from("work_items").select("*").eq("id", item.id).single()).data as WorkItem;
    return outcomeOf(done);
  });
}

export type CandidateDetail = { readonly events: ReadonlyArray<{ id: string; kind: string; actor: string; summary: string; created_at: string }>; readonly cv: { url: string; name: string; mime: string } | null };
export async function loadCandidateDetailAction(id: string): Promise<Result<CandidateDetail>> {
  return run(async (c) => {
    const db = hdb();
    await loadCandidate(db, c.ws, id);
    const events = ((await db.from("hiring_events").select("id, kind, actor, summary, created_at").eq("candidate_id", id).eq("workspace_id", c.ws).order("created_at", { ascending: false }).limit(60)).data ?? []) as CandidateDetail["events"];
    return { events, cv: await cvSignedUrl(db, c.ws, id) };
  });
}

/* ------------------------------------------------------------------ interviews and offers */

export type InterviewInput = { readonly interviewerUserId: string | null; readonly mode: "in_person" | "online"; readonly location: string; readonly durationMin: number };
export async function requestInterviewAction(candidateId: string, input: InterviewInput): Promise<Result<ItemOutcome>> {
  return run(async (c) => {
    const item = await requestInterview(c.ws, candidateId, input);
    if (item.status === "failed") throw new HiringError(item.error ?? "Chưa xếp được lịch phỏng vấn.");
    return outcomeOf(item);
  });
}

export async function setInterviewStatusAction(id: string, status: "done" | "cancelled" | "no_show"): Promise<Result<null>> {
  return run(async (c) => {
    await setInterviewStatus(hdb(), c.ws, id, status, c.name);
    return null;
  });
}

export async function requestOfferAction(candidateId: string, terms: OfferRequest): Promise<Result<ItemOutcome>> {
  return run(async (c) => {
    const { item } = await requestOffer(c.ws, candidateId, terms, c.userId);
    if (item.status === "failed") throw new HiringError(item.error ?? "Chưa soạn được thư mời.");
    return outcomeOf(item);
  });
}

export async function cancelOfferAction(id: string): Promise<Result<null>> {
  return run(async (c) => {
    const up = await hdb().from("hiring_offers").update({ status: "cancelled" }).eq("id", id).eq("workspace_id", c.ws).in("status", ["draft", "waiting", "sent"]).select("candidate_id, work_item_id").maybeSingle();
    if (!up.data) throw new HiringError("Thư mời này không hủy được nữa.");
    const row = up.data as { candidate_id: string; work_item_id: string | null };
    if (row.work_item_id) await hdb().from("work_items").update({ status: "rejected", completed_at: new Date().toISOString() }).eq("id", row.work_item_id).eq("workspace_id", c.ws).eq("status", "waiting_decision");
    await logCandidate(hdb(), c.ws, row.candidate_id, "offer_cancelled", c.name, "Hủy thư mời");
    return null;
  });
}

/* ------------------------------------------------------------------ onboarding, settings, availability */

export async function toggleOnboardingAction(id: string, done: boolean): Promise<Result<null>> {
  return run(async (c) => {
    const up = await hdb().from("hiring_onboarding").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("workspace_id", c.ws);
    if (up.error) throw new Error(up.error.message);
    return null;
  });
}

export async function saveSettingsAction(input: SettingsInput): Promise<Result<null>> {
  return run(async (c) => {
    await saveSettings(hdb(), c.ws, input);
    return null;
  });
}

export type WindowInput = { readonly weekday: number; readonly start_min: number; readonly end_min: number };
export async function saveAvailabilityAction(memberUserId: string, windows: ReadonlyArray<WindowInput>): Promise<Result<{ saved: number }>> {
  return run(async (c) => {
    const db = hdb();
    const m = await db.from("workspace_members").select("user_id").eq("workspace_id", c.ws).eq("user_id", memberUserId).eq("status", "active").maybeSingle();
    if (!m.data) throw new HiringError("Người này không phải thành viên của doanh nghiệp.");
    const ok = windows.filter((w) => Number.isInteger(w.weekday) && w.weekday >= 0 && w.weekday <= 6 && w.start_min >= 0 && w.end_min <= 1440 && w.end_min > w.start_min);
    if (ok.length !== windows.length) throw new HiringError("Có khung giờ chưa hợp lệ (giờ kết thúc phải sau giờ bắt đầu).");
    await db.from("hiring_availability").delete().eq("workspace_id", c.ws).eq("member_user_id", memberUserId);
    if (ok.length) {
      const ins = await db.from("hiring_availability").insert(ok.map((w) => ({ workspace_id: c.ws, member_user_id: memberUserId, weekday: w.weekday, start_min: w.start_min, end_min: w.end_min })));
      if (ins.error) throw new Error(ins.error.message);
    }
    return { saved: ok.length };
  });
}
