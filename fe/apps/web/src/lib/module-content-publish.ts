import "server-only"
import { getTranslations } from "next-intl/server"
import type { Performer } from "./engine"
import type { WorkItem } from "./flow-types"
import { approveContentItem, rejectContentItem } from "@/modules/db"

/**
 * The performer of the `publish_post` authority action (resources/modules/content/module.json: max_mode "ask"). It runs ONLY after a person
 * approved the work item that the workbench created when the owner sent a draft for approval (modules/db/content/write-publish.ts).
 * Approving makes the post approved; nothing is posted to any network from here.
 */

const fieldOf = (item: WorkItem, key: string): string => {
    const value = item.proposal?.fields?.[key]
    if (typeof value === "string") return value
    return value === null || value === undefined ? "" : String(value)
}

/** Performer of `publish_post`: approval marks the post approved, rejection sends it back to draft. */
export const publishPerformer: Performer = {
    prepare: (_c, item) => Promise.resolve({ proposal: item.proposal }),
    perform: async (c, item, proposal, by) => {
        const t = await getTranslations("content")
        const approved = await approveContentItem({
            workspaceId: c.ws,
            itemId: fieldOf(item, "content_item_id"),
            by: by.name,
            workItemId: item.id,
            draft: proposal.draft ?? null,
        })
        if (approved.kind !== "ok") {
            throw new Error(t(approved.code === "wrong_status" ? "err_wrong_status" : "err_item_not_found"))
        }
        return {
            summary: t("performerApproved", { title: approved.value.title }),
            evidence: "reviewed",
            lead_id: null,
            detail: proposal.draft ?? null,
            href: "/agents/content/workbench?tab=queue",
        }
    },
    onReject: async (c, item, _proposal, by) => {
        const id = fieldOf(item, "content_item_id")
        if (id !== "") await rejectContentItem(c.ws, id, by.name)
    },
}
