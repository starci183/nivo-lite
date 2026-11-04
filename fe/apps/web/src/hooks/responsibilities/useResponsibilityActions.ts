"use client"

import { useCopyLeadLink } from "./useCopyLeadLink"
import { useDraftExecution } from "./useDraftExecution"

/** What the board asks of its commands: the follow-up draft and the copied link, with which row each is working on. */
type UseResponsibilityActionsResult = {
    draftingId: string | null
    copiedId: string | null
    draft: (id: string) => undefined
    copy: (id: string, leadId: string) => undefined
}

/** The two commands of an open responsibility: ask the owner to draft the follow-up, and copy the customer link. */
export const useResponsibilityActions = (): UseResponsibilityActionsResult => {
    const { draft, draftingId } = useDraftExecution()
    const { copiedId, copy } = useCopyLeadLink()
    return {
        draftingId,
        copiedId,
        draft: (id: string): undefined => void draft(id),
        copy: (id: string, leadId: string): undefined => void copy(id, leadId),
    }
}
