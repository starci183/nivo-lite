"use client"

import { useCallback } from "react"
import type { navigation } from "@/modules/i18n"
import { agentChatConversationHref } from "@/modules/routes"
import type { ChatTab, AgentChatAgent, Selection } from "./useAgentChat"

/** Keeps opened conversation selection and URL navigation in step. */
export const useAgentChatNavigation = (
    agent: AgentChatAgent | undefined,
    router: ReturnType<typeof navigation.useRouter>,
    setSelected: import("react").Dispatch<import("react").SetStateAction<Selection>>,
    setTab: import("react").Dispatch<import("react").SetStateAction<ChatTab>>,
) => {
    const navigate = useCallback(
        (kind: ChatTab, id: string | null) => {
            if (agent === undefined) return
            router.replace(agentChatConversationHref(agent.agentId, kind, id), { scroll: false })
        },
        [router, agent],
    )
    const opened = useCallback(
        (kind: ChatTab, id: string) => {
            setSelected((current) => ({ ...current, [kind]: id }))
            setTab(kind)
            navigate(kind, id)
        },
        [navigate, setSelected, setTab],
    )
    return { opened, navigate }
}
