import "server-only"

import { getTranslations } from "next-intl/server"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { variantsToJson } from "./content.mapper"
import { readContentItem } from "./read-items"
import { appendItemEvidence } from "./write-events"
import type { ContentItem } from "@/modules/content"

/** What an approval changes in a post. */
export interface ApprovalInput {
    readonly workspaceId: string
    readonly itemId: string
    /** The approver. */
    readonly by: string
    /** The decision (work item) that approved it. */
    readonly workItemId: string
    /** The text the approver may have edited on the approval card; it replaces the first channel text. */
    readonly draft: string | null
}

/**
 * Marks a post waiting for approval as approved (the performer of the publish gate calls this after a person decided).
 * Server-internal, not a Server Action: approval must only follow a decision of the gate.
 */
export const approveContentItem = async (input: ApprovalInput): Promise<DbOutcome<ContentItem>> => {
    const found = await readContentItem(input.workspaceId, input.itemId)
    if (found.kind !== "ok") return found
    const post = found.value
    if (post.status !== "waiting_approval") return dbFailure("invalid", "wrong_status")
    const first = post.channels[0]
    const current = post.variants[first]
    const variants =
        input.draft !== null && current !== undefined && input.draft !== current.text
            ? { ...post.variants, [first]: { ...current, text: input.draft } }
            : post.variants
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({
                status: "approved",
                approved_by: input.by,
                approved_at: new Date().toISOString(),
                variants: variantsToJson(variants),
                work_item_id: input.workItemId,
            })
            .eq("id", input.itemId)
            .eq("workspace_id", input.workspaceId)
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    const t = await getTranslations("content")
    await appendItemEvidence(input.workspaceId, input.itemId, {
        kind: "approved",
        by: input.by,
        text: t("evApproved", { who: input.by, id: input.workItemId }),
    })
    return dbOk(post)
}

/** Sends a post whose approval was refused back to draft. Server-internal. */
export const rejectContentItem = async (workspaceId: string, itemId: string, by: string): Promise<DbOutcome<null>> => {
    const client = await createServerDbClient()
    const saved = await client
        .from("content_items")
        .update({ status: "draft" })
        .eq("id", itemId)
        .eq("workspace_id", workspaceId)
        .eq("status", "waiting_approval")
    const checked = toOutcome({ data: true, error: saved.error })
    if (checked.kind !== "ok") return checked
    const t = await getTranslations("content")
    return appendItemEvidence(workspaceId, itemId, { kind: "rejected", by, text: t("evRejected", { who: by }) })
}
