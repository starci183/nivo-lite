"use client"

import { useCallback, useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateChangeSmtpPasswordSwr } from "@/hooks/swr/api/graphql/mutations/useMutateChangeSmtpPasswordSwr"
import { useMutateSendSmtpTestSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSendSmtpTestSwr"
import { useMutateSetDefaultSmtpSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSetDefaultSmtpSwr"
import { useMutateStartSmtpConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateStartSmtpConnectionSwr"
import type { SmtpCommands } from "./smtp-wizard.shared"

/** The outgoing-email mutations bound to the toast helper: a failure comes back as the back end sentence, the list refreshes after a save. */
export const useSmtpCommands = (): SmtpCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerStart } = useMutateStartSmtpConnectionSwr()
    const { trigger: triggerTest } = useMutateSendSmtpTestSwr()
    const { trigger: triggerPassword } = useMutateChangeSmtpPasswordSwr()
    const { trigger: triggerDefault } = useMutateSetDefaultSmtpSwr()
    const done = useCallback(
        async <T, V>(action: () => Promise<T>, pick: (raw: T) => V): Promise<Settled<V>> => {
            const settled = await settle(action)
            if (settled.kind === "ok") await refresh()
            return settled.kind === "ok" ? { kind: "ok", value: pick(settled.value) } : settled
        },
        [settle, refresh],
    )
    return useMemo(
        () => ({
            start: (input) => done(() => triggerStart(input), (view) => view),
            sendTest: (connectionId, to, makeDefault) =>
                done(() => triggerTest({ connectionId, to, makeDefault }), (tested) => tested),
            changePassword: (connectionId, password) =>
                done(() => triggerPassword({ connectionId, password }), () => true as const),
            setDefault: (connectionId) => done(() => triggerDefault({ connectionId }), () => true as const),
        }),
        [done, triggerStart, triggerTest, triggerPassword, triggerDefault],
    )
}
