"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateAssignAgentWorkSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/**
 * Hands an agent work. The server decides who may and records the request in a work thread; a refusal was already toasted with
 * the server message. Answers whether it worked.
 */
export const useAssignAgentWork = (agentId: string) => {
    const t = useTranslations("agentProfile")
    const runGraphQL = useGraphQLWithToast()
    const assign = useMutateAssignAgentWorkSwr()
    const send = useCallback(
        async (text: string): Promise<boolean> => {
            const done = await runGraphQL(() => assign.trigger({ agentId, text }), { successMessage: t("assignSent") })
            return done !== undefined
        },
        [agentId, assign, runGraphQL, t],
    )
    return { send, isSending: assign.isMutating }
}
