"use client"

import { useCallback, useState } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useConnectionsRole } from "@/hooks/connections"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useMutateSaveWebsiteSiteSwr, useQueryAgentsSwr, useQueryWebsiteSiteSwr } from "@/hooks/swr"
import type { DataSlot, WebsiteChannelAgentView, WebsiteChannelChange, WebsiteChannelView } from "@/modules/types"
import { WEBSITE_CHANNEL_PLACEHOLDER, websiteChannelOf } from "./websiteChannel.shared"

/** What the website channel card draws and does. */
export interface WebsiteChannelRead {
    readonly slot: DataSlot<WebsiteChannelView>
    readonly placeholder: WebsiteChannelView
    /** The agents the customers may be given to; empty while they are read. */
    readonly agents: ReadonlyArray<WebsiteChannelAgentView>
    readonly isAgentsLoading: boolean
    /** Owner or manager change the card. */
    readonly canEdit: boolean
    /** The role is known and is neither owner nor manager: the page is theirs alone, so the card is not drawn. */
    readonly isForbidden: boolean
    /** A change is on its way: the controls wait. */
    readonly isBusy: boolean
    /** The back end words of the last refusal, in the reader's language; null when the last change went through. */
    readonly error: string | null
    readonly retry: () => void
    readonly on: {
        readonly enabled: (isOn: boolean) => void
        readonly chat: (isOn: boolean) => void
        readonly form: (isOn: boolean) => void
        readonly prices: (isOn: boolean) => void
        readonly agent: (agentId: string | null) => void
    }
}

/**
 * The website channel of the workspace: the `websiteSite` read, and one `saveWebsiteSite` per change (a switch or the agent goes at
 * once, no draft); each answer is the saved intake and replaces the cached one. A refusal is the back end's own message.
 */
export const useWebsiteChannel = (): WebsiteChannelRead => {
    const read = useQueryWebsiteSiteSwr()
    const agents = useQueryAgentsSwr({})
    const save = useMutateSaveWebsiteSiteSwr()
    const settle = useSettledGraphQL()
    const roleRead = useConnectionsRole()
    const role = roleRead.role
    const [error, setError] = useState<string | null>(null)
    const { mutate } = read

    const change = useCallback(
        async (request: WebsiteChannelChange): Promise<void> => {
            setError(null)
            const outcome = await settle(() => save.trigger(request))
            if (outcome.kind === "ok") {
                await mutate(outcome.value, { revalidate: false })
                return
            }
            setError(outcome.message)
        },
        [settle, save, mutate],
    )

    return {
        slot: mapSlot(slotOfSwr(read), websiteChannelOf),
        placeholder: WEBSITE_CHANNEL_PLACEHOLDER,
        agents: (agents.data ?? []).map((agent) => ({ id: agent.id, label: agent.name })),
        isAgentsLoading: agents.isLoading,
        canEdit: role === "owner" || role === "manager",
        isForbidden: !roleRead.isLoading && role !== "owner" && role !== "manager",
        isBusy: save.isMutating,
        error,
        retry: () => void read.mutate(),
        on: {
            enabled: (isOn) => void change({ isEnabled: isOn }),
            chat: (isOn) => void change({ chatEnabled: isOn }),
            form: (isOn) => void change({ formEnabled: isOn }),
            prices: (isOn) => void change({ pricesEnabled: isOn }),
            agent: (agentId) => void change({ agentId }),
        },
    }
}
