"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import {
    evidenceToJson,
    linksToJson,
    mediaToJson,
    parseItemPatch,
    parseNewItem,
    variantsToJson,
    type ContentItemRow,
} from "./content.mapper"
import { readContentManager } from "./read-actor"
import { readContentItem } from "./read-items"
import { appendItemEvidence } from "./write-events"
import {
    cleanHashtags,
    isContentChannel,
    type ContentItem,
    type ItemTransition,
    type Variants,
} from "@/modules/content"

/** The most links and media one post keeps. */
const LIST_LIMIT = 10

const refresh = (): void => revalidatePath("/", "layout")

/** Creates a post as an idea. Owner or manager only. */
export const writeCreateItem = async (input: unknown): Promise<DbOutcome<{ readonly id: string }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const parsed = parseNewItem(input)
    if (parsed === null) return dbFailure("invalid", "input")
    const title = parsed.title.trim()
    if (title === "") return dbFailure("invalid", "title_required")
    if (parsed.channels.length === 0) return dbFailure("invalid", "channels_required")
    const t = await getTranslations("content")
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .insert({
                workspace_id: actor.value.workspaceId,
                title: title.slice(0, 200),
                brief: "",
                channels: [...parsed.channels],
                pillar_id: parsed.pillarId,
                scheduled_at: parsed.scheduledAt,
                status: "idea",
                source: "manual",
                created_by: actor.value.name,
                evidence: evidenceToJson([
                    { at: new Date().toISOString(), kind: "created", by: actor.value.name, text: t("evCreated") },
                ]),
            })
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    refresh()
    return dbOk({ id: saved.value.id })
}

type ItemUpdate = Partial<ContentItemRow>

const hasText = (variants: Variants): boolean => Object.values(variants).some((v) => v !== undefined && v.text !== "")

const cleanVariants = (variants: Variants): Variants =>
    Object.fromEntries(
        Object.entries(variants).flatMap(([key, v]) =>
            isContentChannel(key) && v !== undefined
                ? [
                      [
                          key,
                          {
                              text: v.text.slice(0, 6000),
                              hashtags: cleanHashtags(v.hashtags),
                              note: v.note.slice(0, 600),
                          },
                      ],
                  ]
                : [],
        ),
    )

/** The columns an idea or draft may change, from a validated patch. */
const openUpdate = (
    item: ContentItem,
    patch: NonNullable<ReturnType<typeof parseItemPatch>>,
): DbOutcome<ItemUpdate> => {
    const title = patch.title?.trim()
    if (title === "") return dbFailure("invalid", "title_required")
    if (patch.channels !== undefined && patch.channels.length === 0) return dbFailure("invalid", "channels_required")
    const variants = patch.variants === undefined ? undefined : cleanVariants(patch.variants)
    const promoted = variants !== undefined && item.status === "idea" && hasText(variants)
    return dbOk({
        ...(title === undefined ? {} : { title: title.slice(0, 200) }),
        ...(patch.brief === undefined ? {} : { brief: patch.brief.slice(0, 4000) }),
        ...(patch.pillarId === undefined ? {} : { pillar_id: patch.pillarId }),
        ...(patch.channels === undefined ? {} : { channels: [...patch.channels] }),
        ...(variants === undefined ? {} : { variants: variantsToJson(variants) }),
        ...(patch.hashtags === undefined ? {} : { hashtags: cleanHashtags(patch.hashtags) }),
        ...(patch.links === undefined
            ? {}
            : {
                  links: linksToJson(
                      patch.links
                          .filter((l) => /^https?:\/\//i.test(l.url))
                          .slice(0, LIST_LIMIT)
                          .map((l) => ({ url: l.url.trim(), label: l.label.slice(0, 80) })),
                  ),
              }),
        ...(patch.media === undefined ? {} : { media: mediaToJson(patch.media.slice(0, LIST_LIMIT)) }),
        ...(promoted ? { status: "draft", drafted_at: new Date().toISOString() } : {}),
    })
}

/** Edits an idea or a draft. Once a post waits for approval, is approved or published its text is frozen: reopen it first. */
export const writeSaveItem = async (id: string, input: unknown): Promise<DbOutcome<{ readonly id: string }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const patch = parseItemPatch(input)
    if (patch === null) return dbFailure("invalid", "input")
    const found = await readContentItem(actor.value.workspaceId, id)
    if (found.kind !== "ok") return found
    const item = found.value
    const open = item.status === "idea" || item.status === "draft"
    const schedule =
        patch.scheduledAt !== undefined && item.status !== "published" ? { scheduled_at: patch.scheduledAt } : {}
    const body = open ? openUpdate(item, patch) : dbOk<ItemUpdate>({})
    if (body.kind !== "ok") return body
    const row: ItemUpdate = { ...body.value, ...schedule }
    if (Object.keys(row).length === 0) return open ? dbOk({ id }) : dbFailure("invalid", "frozen")
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update(row)
            .eq("id", id)
            .eq("workspace_id", actor.value.workspaceId)
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    if (open && (row.variants !== undefined || row.title !== undefined)) {
        const t = await getTranslations("content")
        await appendItemEvidence(actor.value.workspaceId, id, {
            kind: "edited",
            by: actor.value.name,
            text: t("evEdited", { who: actor.value.name }),
        })
    }
    refresh()
    return dbOk({ id })
}

/** Moves a post to another date and time (calendar drag). Published posts keep their date. */
export const writeMoveItem = async (id: string, scheduledAt: string): Promise<DbOutcome<{ readonly id: string }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    if (typeof scheduledAt !== "string" || Number.isNaN(Date.parse(scheduledAt)))
        return dbFailure("invalid", "date_invalid")
    const found = await readContentItem(actor.value.workspaceId, id)
    if (found.kind !== "ok") return found
    if (found.value.status === "published") return dbFailure("invalid", "published_locked")
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({ scheduled_at: scheduledAt })
            .eq("id", id)
            .eq("workspace_id", actor.value.workspaceId)
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    const t = await getTranslations("content")
    await appendItemEvidence(actor.value.workspaceId, id, {
        kind: "rescheduled",
        by: actor.value.name,
        text: t("evRescheduled", { who: actor.value.name }),
    })
    refresh()
    return dbOk({ id })
}

const TRANSITION_EVIDENCE: Readonly<Record<ItemTransition, string>> = {
    skip: "evSkip",
    restore: "evRestore",
    reopen: "evReopen",
    delete: "evSkip",
}

const nextStatus = (item: ContentItem, kind: ItemTransition): ContentItem["status"] | null => {
    if (kind === "skip") return ["idea", "draft", "approved"].includes(item.status) ? "skipped" : null
    if (kind === "restore") {
        if (item.status !== "skipped") return null
        return hasText(item.variants) ? "draft" : "idea"
    }
    return item.status === "approved" ? "draft" : null
}

/** Skips, restores, reopens or deletes a post. Delete: ideas, drafts and skipped posts only. */
export const writeTransitionItem = async (
    id: string,
    kind: ItemTransition,
): Promise<DbOutcome<{ readonly id: string }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const found = await readContentItem(actor.value.workspaceId, id)
    if (found.kind !== "ok") return found
    const client = await createServerDbClient()
    if (kind === "delete") {
        if (!["idea", "draft", "skipped"].includes(found.value.status)) return dbFailure("invalid", "delete_status")
        const removed = await client
            .from("content_items")
            .delete()
            .eq("id", id)
            .eq("workspace_id", actor.value.workspaceId)
        const checked = toOutcome({ data: true, error: removed.error })
        if (checked.kind !== "ok") return checked
        refresh()
        return dbOk({ id })
    }
    const status = nextStatus(found.value, kind)
    if (status === null) return dbFailure("invalid", "transition_status")
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({ status, ...(kind === "reopen" ? { approved_by: null, approved_at: null } : {}) })
            .eq("id", id)
            .eq("workspace_id", actor.value.workspaceId)
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    const t = await getTranslations("content")
    await appendItemEvidence(actor.value.workspaceId, id, {
        kind,
        by: actor.value.name,
        text: t(TRANSITION_EVIDENCE[kind], { who: actor.value.name }),
    })
    refresh()
    return dbOk({ id })
}
