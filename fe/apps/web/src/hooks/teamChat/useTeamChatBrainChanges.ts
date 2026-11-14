"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutateDecideBrainChangeSwr } from "@/hooks/swr"
import { isRefusedByBackend } from "@/modules/failure"
import { toast } from "@/modules/toast"
import type { TeamChatBrainChangeAction } from "@/modules/types"

/** The view `useTeamChatBrainChanges` returns. */
export interface TeamChatBrainChangesView {
    /** The change whose decision is in flight, or null. */
    readonly pendingId: string | null
    readonly act: (changeId: string, action: TeamChatBrainChangeAction) => Promise<void>
}

/**
 * What is done with the truth-change cards of the open room: Agree, No or Keep both go to the one decide door (`decideBrainChange`).
 * The door proves the right again (a manager pressing Agree is answered `founder_only`) and answers an outcome, each said in words; a
 * refusal of the role is its own message. After any press `onChanged` reads the thread again, so the card the back end rewrote in
 * place (same message, new revision) is drawn anew.
 */
export const useTeamChatBrainChanges = (onChanged: () => void): TeamChatBrainChangesView => {
    const t = useTranslations("brainChange")
    const decide = useMutateDecideBrainChangeSwr()
    const [pendingId, setPendingId] = useState<string | null>(null)
    const say = (outcome: string): void => {
        if (outcome === "applied" || outcome === "rejected" || outcome === "kept_both") toast.success(t("toast.done"))
        else if (outcome === "founder_only") toast.danger(t("toast.ownerOnly"))
        else if (outcome === "already_decided") toast.info(t("toast.alreadyDecided"))
        else if (outcome === "not_offered") toast.info(t("toast.notOffered"))
        else if (outcome === "not_found") toast.danger(t("toast.notFound"))
        else toast.danger(t("toast.failedTitle"), { description: t("toast.failedText") })
    }
    const failed = (error: unknown): void => {
        const description = isRefusedByBackend(error) && error instanceof Error ? error.message : t("toast.failedText")
        toast.danger(t("toast.failedTitle"), { description })
    }
    return {
        pendingId,
        act: async (changeId, action) => {
            setPendingId(changeId)
            try {
                const answer = await decide.trigger({ changeId, action, note: null })
                say(answer.outcome)
            } catch (error) {
                failed(error)
            }
            setPendingId(null)
            onChanged()
        },
    }
}
