"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { metaCheckOf, metaWizardOf } from "@/hooks/connection-wire"
import { useMutateAuthorizeMetaSwr, useMutateCheckMetaSwr, useMutateChooseMetaPageSwr } from "@/hooks/swr"
import type { MetaCheck, MetaWizardConnection } from "@/modules/types"

/** The GraphQL commands of the Meta wizard (the active workspace travels in the request header). */
export interface MetaCommands {
    /** Where to send the browser to log in with Facebook; a missing id starts a new connection. */
    readonly authorize: (connectionId: string | undefined) => Promise<Settled<string>>
    readonly choosePage: (connectionId: string, pageId: string) => Promise<Settled<MetaWizardConnection>>
    readonly check: (connectionId: string, repair: boolean) => Promise<Settled<MetaCheck>>
}

/** The Meta wizard's mutations bound to the toast helper. */
export const useMetaCommands = (): MetaCommands => {
    const settle = useSettledGraphQL()
    const { trigger: triggerAuthorize } = useMutateAuthorizeMetaSwr()
    const { trigger: triggerChoose } = useMutateChooseMetaPageSwr()
    const { trigger: triggerCheck } = useMutateCheckMetaSwr()
    return useMemo(
        () => ({
            authorize: async (connectionId) => {
                const settled = await settle(() => triggerAuthorize(connectionId === undefined ? {} : { connectionId }))
                return settled.kind === "ok" ? { kind: "ok", value: settled.value.url } : settled
            },
            choosePage: async (connectionId, pageId) => {
                const settled = await settle(() => triggerChoose({ connectionId, pageId }))
                return settled.kind === "ok" ? { kind: "ok", value: metaWizardOf(settled.value) } : settled
            },
            check: async (connectionId, repair) => {
                const settled = await settle(() => triggerCheck({ connectionId, repair }))
                return settled.kind === "ok" ? { kind: "ok", value: metaCheckOf(settled.value) } : settled
            },
        }),
        [settle, triggerAuthorize, triggerChoose, triggerCheck],
    )
}
