"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { slotOfSwr } from "@/hooks/slot"
import { useMutateSaveCrmConnectionSwr, useQueryCrmConnectionSwr } from "@/hooks/swr"
import { CRM_REFUSAL_CODE, type CrmView } from "@/modules/crm"
import type { DataSlot } from "@/modules/types"

/** What a CRM connection's page reads and does. */
interface CrmPinRead {
    /** The saved connection with its pin. */
    readonly slot: DataSlot<CrmView>
    /** Pins the live Swagger again: saves with the stored values and a blank key, so the stored key stays. */
    readonly repin: () => void
    readonly isPending: boolean
    /** Why the last re-pin failed, in the reader's language. */
    readonly error: string | null
    readonly retry: () => void
}

/** The saved CRM connection of an account, and the command that pins its live Swagger again. */
export const useCrmPin = (connectionId: string): CrmPinRead => {
    const t = useTranslations("connectorCrm")
    const settle = useSettledGraphQL()
    const read = useQueryCrmConnectionSwr(connectionId === "" ? undefined : connectionId)
    const { trigger } = useMutateSaveCrmConnectionSwr()
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const repin = (): void =>
        startTransition(async () => {
            const view = read.data
            if (view === undefined) return
            setError(null)
            const settled = await settle(() =>
                trigger({
                    connectionId,
                    crmId: view.crmId,
                    baseUrl: view.baseUrl,
                    swaggerUrl: view.swaggerUrl,
                    auth: {
                        type: view.authType === "header" ? "header" : "bearer",
                        ...(view.authType === "header" ? { name: view.authName } : {}),
                        value: "",
                    },
                }),
            )
            if (settled.kind === "failed") {
                setError(settled.code === CRM_REFUSAL_CODE && t.has(`detail_${settled.message}`) ? t(`detail_${settled.message}`) : settled.message)
                return
            }
            await read.mutate()
        })
    return { slot: slotOfSwr(read), repin, isPending, error, retry: () => void read.mutate() }
}
