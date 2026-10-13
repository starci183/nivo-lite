import "server-only"
import { getTranslations } from "next-intl/server"
import { asciiFold } from "@/modules/video"
import { createVideoProject } from "@/modules/db/video/write-project"
import { startVideoScript } from "@/modules/db/video/write-script"
import type { Executor } from "./automation-runs"
import { str } from "./automation-runs"
import { lensFor, lensSources } from "./knowledge/lens"

/**
 * Automation "write a video when a new offer appears" (resources/automation-templates/video_new_offer.json). Default OFF, needs the video module.
 * Trigger: a PUBLIC knowledge source whose topic is an offer or promotion appears after the owner switched the automation on. The tick finds it
 * (offerSources, called from automation-engine.ts scan), the executor creates a draft project and has OpenClaw write the script. It never renders
 * and never publishes: both stay the owner's click (publish_video is always "ask").
 *
 * The draft is written under a person's session (row level security): a tick has none, so there the executor skips with a reason until the
 * back end owns this automation.
 */
const strip = (value: string): string => asciiFold(value).toLowerCase()

/** Whether a knowledge topic names an offer or a promotion. */
export const isOfferTopic = (topic: string | null | undefined): boolean =>
    /\b(uu dai|khuyen mai|promotion|offer)\b/.test(strip(topic ?? ""))

/** A new offer source a video can be made from. */
export type OfferSource = { readonly id: string; readonly title: string }

/** The database handle the knowledge lens takes. */
type LensDb = Parameters<typeof lensSources>[2]

/** Sources added since the automation was last switched on or saved (and in the last 7 days) that a video can be made from. */
export const offerSources = async (
    db: LensDb,
    ws: string,
    since: Date,
    now: Date = new Date(),
): Promise<Array<OfferSource>> => {
    const from = new Date(Math.max(since.getTime(), now.getTime() - 7 * 86_400_000)).toISOString()
    const rows = (await lensSources(lensFor(ws, "video"), 200, db))
        .filter((row) => row.topic !== null && row.created_at >= from)
        .slice(0, 20)
    return rows.filter((row) => isOfferTopic(row.topic)).map((row) => ({ id: row.id, title: row.title }))
}

/** Creates the draft video of a new offer and starts its script. */
export const videoNewOffer: Executor = async (x, payload) => {
    const t = await getTranslations("video")
    const sourceId = str(payload.source_id)
    const title = str(payload.title) === "" ? t("automationOfferTitle") : str(payload.title)
    try {
        const created = await createVideoProject({
            goal: "offer",
            aspect: "9:16",
            targetSeconds: 20,
            title: t("automationDraftTitle", { title }).slice(0, 120),
            inputs: { sourceIds: [sourceId], notes: "", media: [], auto: true },
        })
        if (created.kind !== "ok") {
            return {
                status: "skipped",
                steps: [{ label: t("automationSkipped"), status: "skipped", detail: t("automationNeedsSession") }],
            }
        }
        await startVideoScript(created.value.id)
        return {
            status: "done",
            steps: [
                { label: t("automationStepDraft", { title }), status: "done", detail: created.value.title },
                { label: t("automationStepScript"), status: "done" },
            ],
            evidence: created.value.id,
        }
    } catch {
        return {
            status: "skipped",
            steps: [{ label: t("automationSkipped"), status: "skipped", detail: t("automationNeedsSession") }],
        }
    }
}
