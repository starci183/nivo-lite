import "server-only"
import { getTranslations } from "next-intl/server"
import { writeRenderVideo } from "@/modules/db/video/write-render"
import { markVideoApproved } from "@/modules/db"
import { logEvidence } from "./core"
import type { Performer } from "./engine"
import type { WorkItem } from "./flow-types"

/**
 * What happens once the authority gate lets a video action through (registered in module-performers.ts).
 *   render_draft   queue a draft render (default auto; assist mode downgrades it to a decision).
 *   publish_video  runs ONLY after the owner approved (max_mode "ask"). It marks the video approved and records the evidence. NIVO does not post it to
 *                  TikTok or Facebook: the owner downloads or shares the file, posts it, and presses the "posted" button (the only way to published).
 * Kept free of engine runtime imports (types only): engine.ts imports module-performers.ts, which imports this file.
 */
const field = (item: WorkItem, key: string): string => {
    const value = item.proposal?.fields?.[key]
    return typeof value === "string" ? value : ""
}

/** Marks the video approved once the owner decided. */
export const publishVideoPerformer: Performer = {
    prepare: (_c, item) =>
        Promise.resolve({
            proposal: { ...item.proposal, summary: item.proposal?.summary ?? "", fields: item.proposal?.fields ?? {} },
        }),
    perform: async (c, item, _p, by) => {
        const projectId = field(item, "project_id")
        const t = await getTranslations({ locale: c.locale, namespace: "video" })
        if (projectId === "") throw new Error(t("gateMissingId"))
        const approved = await markVideoApproved(c.ws, projectId, by.name)
        if (approved.kind !== "ok") throw new Error(t("gateNotApproved"))
        await logEvidence(c.db, c.ws, {
            work_item_id: item.id,
            kind: "video.approved",
            actor: by.name,
            summary: t("gateApprovedEvidence", { name: by.name, title: approved.value.title }),
            evidence: t("gateApprovedDetail", { render: approved.value.renderId ?? "" }),
        })
        return {
            summary: t("gateApprovedSummary", { title: approved.value.title }),
            evidence: "reviewed",
            href: "/agents/video/workbench",
        }
    },
}

/** Queues the render of a draft once the gate allowed it (needs the signed-in session of the person who triggered it). */
export const renderDraftPerformer: Performer = {
    prepare: (_c, item) =>
        Promise.resolve({
            proposal: { ...item.proposal, summary: item.proposal?.summary ?? "", fields: item.proposal?.fields ?? {} },
        }),
    perform: async (c, item) => {
        const projectId = field(item, "project_id")
        const t = await getTranslations({ locale: c.locale, namespace: "video" })
        if (projectId === "") throw new Error(t("gateMissingId"))
        const queued = await writeRenderVideo(projectId)
        if (queued.kind !== "ok") throw new Error(t("gateRenderRefused"))
        return {
            summary: t("gateRenderQueued", { title: field(item, "title") }),
            evidence: "captured",
            href: "/agents/video/workbench",
            detail: queued.value.renderId,
        }
    },
}
