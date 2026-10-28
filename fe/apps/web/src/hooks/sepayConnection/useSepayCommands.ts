"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { mutate } from "swr"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import {
    QUERY_SEPAY_CONNECTION_SWR_KEY,
    useMutateDisconnectConnectionSwr,
    useMutateRevealSepayKeySwr,
    useMutateSetSepayEnvironmentSwr,
    useMutateUpdateMoneyConnectionSwr,
} from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import type { SepayAccountForm, SepayConnectionView, SepayEnvironment } from "@/modules/types"

/** The writes of the SePay connection page. */
export interface SepayCommands {
    readonly setEnvironment: (environment: SepayEnvironment) => Promise<Settled<true>>
    readonly saveAccount: (view: SepayConnectionView, form: SepayAccountForm) => Promise<Settled<true>>
    readonly disconnect: () => Promise<Settled<true>>
    /** Asks the owner-only reveal for the key and hands it back for the clipboard only. */
    readonly revealKey: () => Promise<Settled<string>>
}

/** The commands of one SePay connection page, each toasting its outcome and refreshing what it changed. */
export const useSepayCommands = (connectionId: string): SepayCommands => {
    const t = useTranslations("sepayConnection")
    const settle = useSettledGraphQL()
    const refreshHub = useConnectionsRefresh()
    const { trigger: triggerEnvironment } = useMutateSetSepayEnvironmentSwr()
    const { trigger: triggerUpdate } = useMutateUpdateMoneyConnectionSwr()
    const { trigger: triggerDisconnect } = useMutateDisconnectConnectionSwr()
    const { trigger: triggerReveal } = useMutateRevealSepayKeySwr()
    const refreshPage = useCallback(() => mutate(matchesSwrKey(QUERY_SEPAY_CONNECTION_SWR_KEY)), [])
    return useMemo(
        () => ({
            setEnvironment: async (environment) => {
                const settled = await settle(
                    () => triggerEnvironment({ connectionId, environment }),
                    t(environment === "live" ? "toastLive" : "toastTest"),
                )
                if (settled.kind !== "ok") return settled
                await Promise.all([refreshPage(), refreshHub()])
                return { kind: "ok", value: true }
            },
            saveAccount: async (view, form) => {
                const settled = await settle(
                    () =>
                        triggerUpdate({
                            connectionId,
                            environment: view.environment,
                            name: view.name,
                            bankCode: form.bank === "" ? view.bankCode : form.bank,
                            accountNumber: form.account,
                            holder: form.holder === "" ? view.holder : form.holder,
                        }),
                    t("toastAccountSaved"),
                )
                if (settled.kind !== "ok") return settled
                await Promise.all([refreshPage(), refreshHub()])
                return { kind: "ok", value: true }
            },
            disconnect: async () => {
                const settled = await settle(() => triggerDisconnect({ connectionId }), t("toastDisconnected"))
                if (settled.kind !== "ok") return settled
                await Promise.all([refreshPage(), refreshHub()])
                return { kind: "ok", value: true }
            },
            revealKey: async () => {
                const settled = await settle(() => triggerReveal({ connectionId }))
                return settled.kind === "ok" ? { kind: "ok", value: settled.value.apiKey } : settled
            },
        }),
        [
            settle,
            connectionId,
            t,
            triggerEnvironment,
            triggerUpdate,
            triggerDisconnect,
            triggerReveal,
            refreshPage,
            refreshHub,
        ],
    )
}
