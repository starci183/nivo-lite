import "server-only"
import { getTranslations } from "next-intl/server"
import { readProjectBrief } from "@/modules/db"
import type { ProjectBrief } from "@/modules/db"
import { estimateScriptSeconds } from "@/modules/video"
import { resumeWork, runWork, type Decider, type EngineCtx, type WorkSpec } from "./engine"
import type { WorkItem } from "./flow-types"

/**
 * The "video" module through the authority gate. Two actions (resources/modules/video/module.json):
 *   render_draft   queue a draft render. Default auto, but a module in assist mode downgrades it to ask.
 *   publish_video  the owner's approval of a finished video. max_mode "ask": it NEVER runs without a person; after the approval the video is approved
 *                  (download and share are unlocked). NIVO does not post it to TikTok or Facebook: the owner posts the file and marks it published.
 * Work items use subject_type "video_project" (the table accepts any lower_snake subject since migration 20261009100000).
 */
const SUBJECT = "video_project" as WorkSpec["subject_type"]

const briefOf = async (c: EngineCtx, projectId: string): Promise<ProjectBrief> => {
    const brief = await readProjectBrief(c.ws, projectId)
    if (brief.kind !== "ok") throw new Error("video-not-found")
    return brief.value
}

/** Ask the gate to render a draft (the gate decides: auto, or a decision for the owner). */
export const requestRender = async (c: EngineCtx, projectId: string): Promise<WorkItem> => {
    const project = await briefOf(c, projectId)
    const t = await getTranslations({ locale: c.locale, namespace: "video" })
    return runWork(c, {
        action: "render_draft",
        subject_type: SUBJECT,
        subject_id: projectId,
        origin: "live",
        preset: true,
        noChain: true,
        dedupeKey: `render_draft:${projectId}:v${project.version}`,
        seed: {
            summary: t("gateRenderSummary", { title: project.title }),
            fields: { project_id: projectId, title: project.title, aspect: project.aspect },
        },
    })
}

/**
 * The owner approves a finished video. The request goes through the publish_video gate (always "ask": a decision is recorded for the
 * person), and the owner's click is that decision (the same resumeWork the Office buttons call). Returns the finished work item.
 */
export const approveVideo = async (c: EngineCtx, projectId: string, by: Decider): Promise<WorkItem> => {
    const project = await briefOf(c, projectId)
    if (project.renderId === null) throw new Error("video-no-render")
    if (project.status !== "ready") throw new Error("video-not-ready")
    const base = `publish_video:${projectId}:${project.renderId}`
    const found = await c.db
        .from("work_items")
        .select("*")
        .eq("workspace_id", c.ws)
        .eq("action", "publish_video")
        .like("dedupe_key", `${base}%`)
        .order("created_at", { ascending: false })
    const prior: ReadonlyArray<WorkItem> = found.data ?? []
    const waiting = prior.find((entry) => entry.status === "waiting_decision") ?? null
    const t = await getTranslations({ locale: c.locale, namespace: "video" })
    const item =
        waiting ??
        (await runWork(c, {
            action: "publish_video",
            subject_type: SUBJECT,
            subject_id: projectId,
            origin: "live",
            preset: true,
            noChain: true,
            dedupeKey: prior.length > 0 ? `${base}:${prior.length + 1}` : base,
            seed: {
                summary: t("gateApproveSummary", {
                    title: project.title,
                    aspect: project.aspect,
                    seconds: estimateScriptSeconds(project.script),
                }),
                draft: project.script
                    .map(
                        (scene, index) =>
                            `${index + 1}. ${scene.caption}${scene.voiceover === "" ? "" : ` - ${scene.voiceover}`}`,
                    )
                    .join("\n"),
                fields: { project_id: projectId, render_id: project.renderId, title: project.title },
            },
        }))
    if (item.status === "done") return item
    if (item.status !== "waiting_decision") throw new Error(item.error ?? "video-not-sent")
    return resumeWork(c, item.id, "approved", {}, by, t("gateApproveNote"))
}
