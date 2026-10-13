"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { drainAfter, engineCtx } from "@/lib/flow-ctx"
import { runWork, type EngineCtx, type WorkSpec } from "@/lib/engine"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { publishedToJson } from "./content.mapper"
import { readContentManager } from "./read-actor"
import { readContentItem } from "./read-items"
import { appendItemEvidence, appendWorkspaceEvent } from "./write-events"
import { contentChannelLabel, channelRule, isContentChannel, type PublishedMark } from "@/modules/content"

/** Runs the work through the gate; null when the engine could not take it. */
const submitWork = async (c: EngineCtx, spec: WorkSpec) => {
    try {
        return await runWork(c, spec)
    } catch {
        return null
    }
}

const refresh = (): void => revalidatePath("/", "layout")

/**
 * Sends a draft for approval. `publish_post` is an authority action capped at ask, so it never runs alone: the gate makes a work item that
 * waits in the decision queue, and the post becomes waiting_approval. Nothing is posted to any network from here.
 */
export const writeSubmitForApproval = async (
    id: string,
): Promise<DbOutcome<{ readonly id: string; readonly workItemId: string }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const found = await readContentItem(actor.value.workspaceId, id)
    if (found.kind !== "ok") return found
    const item = found.value
    if (item.status === "idea") return dbFailure("invalid", "not_drafted")
    if (item.status !== "draft") return dbFailure("invalid", "wrong_status")
    if (item.channels.some((channel) => (item.variants[channel]?.text ?? "").trim() === "")) {
        return dbFailure("invalid", "text_missing")
    }
    const t = await getTranslations("content")
    const c = await engineCtx()
    const rounds = item.evidence.filter((e) => e.kind === "submitted").length
    const first = item.channels[0]
    const spec: WorkSpec = {
        action: "publish_post",
        subject_type: "inbound",
        subject_id: item.id,
        origin: "live",
        preset: true,
        noChain: true,
        dedupeKey: `publish_post:${item.id}:${rounds + 1}`,
        seed: {
            summary: t("gateSummary", {
                title: item.title,
                channels: item.channels.map(contentChannelLabel).join(", "),
            }),
            draft: item.variants[first]?.text ?? "",
            fields: {
                content_item_id: item.id,
                channels: item.channels.join(","),
                scheduled_at: item.scheduled_at ?? "",
            },
        },
    }
    const work = await submitWork(c, spec)
    if (work === null || work.status === "failed") return dbFailure("unavailable", "gate_failed")
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({ status: work.status === "done" ? "approved" : "waiting_approval", work_item_id: work.id })
            .eq("id", item.id)
            .eq("workspace_id", actor.value.workspaceId)
            .eq("status", "draft")
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    await appendItemEvidence(actor.value.workspaceId, item.id, {
        kind: "submitted",
        by: actor.value.name,
        text: t("evSubmitted", { who: actor.value.name, id: work.id }),
    })
    drainAfter(c)
    refresh()
    return dbOk({ id, workItemId: work.id })
}

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

/**
 * Marks a post as posted by hand on one channel. Needs an approved post; the proof (a link or a note) is kept on the post and in the audit
 * log. When every channel of the post is marked, the post becomes published.
 */
export const writeMarkPublished = async (
    id: string,
    channel: string,
    url: string,
    how: string,
): Promise<DbOutcome<{ readonly allDone: boolean }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    if (!isContentChannel(channel)) return dbFailure("invalid", "channel_invalid")
    const found = await readContentItem(actor.value.workspaceId, id)
    if (found.kind !== "ok") return found
    const item = found.value
    if (item.status !== "approved" && item.status !== "published") return dbFailure("invalid", "wrong_status")
    if (!item.channels.includes(channel)) return dbFailure("invalid", "channel_invalid")
    const link = url.trim()
    if (link !== "" && !isHttpUrl(link)) return dbFailure("invalid", "url_invalid")
    const t = await getTranslations("content")
    const at = new Date().toISOString()
    const mark: PublishedMark = { at, by: actor.value.name, url: link, how: how.trim() || t("postedHowDefault") }
    const published = { ...item.published, [channel]: mark }
    const allDone = item.channels.every((ch) => published[ch] !== undefined)
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({
                published: publishedToJson(published),
                ...(allDone ? { status: "published", published_at: at } : {}),
            })
            .eq("id", id)
            .eq("workspace_id", actor.value.workspaceId)
            .in("status", ["approved", "published"])
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    const label = channelRule(channel).label
    await appendItemEvidence(actor.value.workspaceId, id, {
        kind: "published",
        at,
        by: actor.value.name,
        text:
            link === ""
                ? t("evPublishedHow", { who: actor.value.name, channel: label, how: mark.how })
                : t("evPublishedUrl", { who: actor.value.name, channel: label, url: link }),
    })
    await appendWorkspaceEvent(actor.value.workspaceId, {
        kind: "content.published",
        actor: actor.value.name,
        summary: t("evtPublished", { title: item.title, channel: label }),
        evidence: link || mark.how,
    })
    refresh()
    return dbOk({ allDone })
}
