"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useMutateWantConnectorSwr } from "@/hooks/swr/api/graphql/mutations/useMutateWantConnectorSwr"

/** Says the workspace wants a planned connector ("I want it", owner or manager); recorded once per workspace. */
export const useWantConnector = () => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const { trigger } = useMutateWantConnectorSwr()
    return useCallback(
        async (connectorId: string): Promise<Settled<true>> => {
            const settled = await settle(() => trigger({ connectorId }), t("detailWanted"))
            return settled.kind === "ok" ? { kind: "ok", value: true } : settled
        },
        [settle, trigger, t],
    )
}
