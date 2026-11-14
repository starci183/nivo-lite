"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    QUERY_PROVIDER_RIGHTS_SWR_KEY,
    QUERY_SANDBOX_ACCOUNTS_SWR_KEY,
    useMutateAttachSandboxAccountSwr,
    useMutateDetachSandboxAccountSwr,
    useMutateSetAgentProviderDefaultSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshSandbox } from "./sandbox.shared"

/** The commands on the agents of an account: give it to some, take it from one, make it one's default. */
export interface SandboxAgentCommands {
    /** Gives the account to each agent in turn; stops at the first refusal (toasted with the back end words); answers whether all worked. */
    readonly attach: (connectionId: string, agentIds: ReadonlyArray<string>) => Promise<boolean>
    readonly detach: (connectionId: string, agentId: string) => Promise<boolean>
    readonly setDefault: (connectionId: string, agentId: string) => Promise<boolean>
    readonly isAttaching: boolean
    /** The agent being taken off, or made default; null when none is. */
    readonly detachingId: string | null
    readonly defaultingId: string | null
}

/** Reads again what an agent change moved: the accounts with their agents and the attachments with their defaults. */
const refreshAgents = (): Promise<void> => refreshSandbox(QUERY_SANDBOX_ACCOUNTS_SWR_KEY, QUERY_PROVIDER_RIGHTS_SWR_KEY)

/** Attaches, detaches and defaults sandbox accounts through the back end, toasted in plain words, refreshing what they changed. */
export const useSandboxAgentCommands = (): SandboxAgentCommands => {
    const t = useTranslations("sandbox")
    const run = useGraphQLWithToast()
    const attaching = useMutateAttachSandboxAccountSwr()
    const detaching = useMutateDetachSandboxAccountSwr()
    const defaulting = useMutateSetAgentProviderDefaultSwr()
    const [isAttaching, setIsAttaching] = useState(false)
    const [detachingId, setDetachingId] = useState<string | null>(null)
    const [defaultingId, setDefaultingId] = useState<string | null>(null)
    return {
        attach: async (connectionId, agentIds) => {
            setIsAttaching(true)
            try {
                const isAllDone = await agentIds.reduce<Promise<boolean>>(
                    (chain, agentId) =>
                        chain.then(async (isDone) =>
                            isDone
                                ? (await run(() => attaching.trigger({ connectionId, agentId }), {
                                      showSuccessToast: false,
                                  })) !== undefined
                                : false,
                        ),
                    Promise.resolve(true),
                )
                await refreshAgents()
                if (isAllDone) toast.success(t("toastAttached"))
                return isAllDone
            } finally {
                setIsAttaching(false)
            }
        },
        detach: async (connectionId, agentId) => {
            setDetachingId(agentId)
            try {
                const answer = await run(() => detaching.trigger({ connectionId, agentId }), {
                    successMessage: t("toastDetached"),
                })
                await refreshAgents()
                return answer !== undefined
            } finally {
                setDetachingId(null)
            }
        },
        setDefault: async (connectionId, agentId) => {
            setDefaultingId(agentId)
            try {
                const answer = await run(() => defaulting.trigger({ connectionId, agentId }), {
                    successMessage: t("toastDefaulted"),
                })
                await refreshAgents()
                return answer !== undefined
            } finally {
                setDefaultingId(null)
            }
        },
        isAttaching,
        detachingId,
        defaultingId,
    }
}
