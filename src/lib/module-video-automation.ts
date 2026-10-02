import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actorOf, str, type Executor } from "./automation-runs";
import { beginScripting, createProject, runScripting, type VideoCtx } from "./module-video-core";

/**
 * Automation "Soạn video khi có ưu đãi mới" (resources/automation-templates/video_new_offer.json). Default OFF, needs the video module.
 * Trigger: a PUBLIC knowledge source whose topic is Ưu đãi / Khuyến mãi appears after the owner switched the automation on. The tick finds it
 * (offerSources, called from automation-engine.ts scan), the executor creates a draft project and has OpenClaw write the script, then tells the owner in
 * Office. It never renders and never publishes: both stay the owner's click (publish_video is always "ask").
 */
const strip = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
export const isOfferTopic = (topic: string | null | undefined): boolean => /\b(uu dai|khuyen mai|promotion|offer)\b/.test(strip(topic ?? ""));

export type OfferSource = { readonly id: string; readonly title: string };

/** Sources added since the automation was last switched on or saved (and in the last 7 days) that a video can be made from. */
export const offerSources = async (db: SupabaseClient, ws: string, since: Date, now: Date = new Date()): Promise<Array<OfferSource>> => {
  const from = new Date(Math.max(since.getTime(), now.getTime() - 7 * 86_400_000)).toISOString();
  const { data } = await db.from("knowledge_sources").select("id, title, topic").eq("workspace_id", ws).eq("visibility", "public").eq("status", "ready").gte("created_at", from).not("topic", "is", null).order("created_at").limit(20);
  return ((data ?? []) as Array<{ id: string; title: string; topic: string | null }>).filter((r) => isOfferTopic(r.topic)).map((r) => ({ id: r.id, title: r.title }));
};

/** The script takes a minute: it finishes after the tick's response (a long-lived server keeps running; a function platform extends via after()). */
const later = (fn: () => Promise<unknown>): void => {
  const safe = () => fn().catch((e) => console.error("video offer script failed:", e instanceof Error ? e.message : e));
  try {
    after(safe);
  } catch {
    void safe();
  }
};

export const videoNewOffer: Executor = async (x, p) => {
  const sourceId = str(p.source_id);
  const title = str(p.title) || "Ưu đãi mới";
  const src = ((await x.db.from("knowledge_sources").select("id").eq("workspace_id", x.ws).eq("id", sourceId).eq("visibility", "public").maybeSingle()).data ?? null) as { id: string } | null;
  if (!src) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Tri thức này không còn hoặc chưa để công khai." }] };
  const c: VideoCtx = { db: x.db, ws: x.ws, userId: null, actor: actorOf(x.def) };
  const project = await createProject(c, {
    goal: "offer", aspect: "9:16", targetSeconds: 20, title: `Soạn tự động · ${title}`.slice(0, 120),
    inputs: { sourceIds: [sourceId], notes: "", media: [], auto: true },
  });
  if (await beginScripting(c, project.id)) later(() => runScripting(c, project.id, { notify: true }));
  return {
    status: "done",
    steps: [
      { label: `Tạo bản nháp video từ «${title}»`, status: "done", detail: project.title },
      { label: "NIVO đang soạn kịch bản, xong sẽ báo bạn trong Văn phòng", status: "done" },
    ],
    evidence: `Bản nháp ${project.id}`,
  };
};
