"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { useSettledGraphQL, useZaloFailureLabel } from "@/hooks/connection-wizard"
import { useConnectionsRole } from "@/hooks/connections"
import { mapSlot } from "@/hooks/slot"
import { useMutateSaveZnsRenewalSwr } from "@/hooks/swr"
import type { DataSlot, ZnsRenewalForm } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"
import { EMPTY_ZNS_FORM } from "./zaloConnection.shared"

type UseZnsRenewalResult = {
    slot: DataSlot<ZnsRenewalForm>
    form: ZnsRenewalForm
    change: (patch: Partial<ZnsRenewalForm>) => void
    save: () => Promise<void>
    isSaving: boolean
    canEdit: boolean
    note: string
    reload: () => undefined
}

/** The ZNS renewal template of the connection: what is stored, what the owner has typed over it, and the save. */
export const useZnsRenewal = (connectionId: string): UseZnsRenewalResult => {
    const t = useTranslations("zaloConnection")
    const settle = useSettledGraphQL()
    const labelOf = useZaloFailureLabel()
    const { role } = useConnectionsRole()
    const { slot, mutate } = useZaloPage(connectionId)
    const { trigger, isMutating } = useMutateSaveZnsRenewalSwr()
    const [draft, setDraft] = useState<Partial<ZnsRenewalForm>>({})
    const [note, setNote] = useState("")

    const stored: DataSlot<ZnsRenewalForm> = mapSlot(slot, (page) => ({
        templateId: page.znsRenewal?.templateId ?? "",
        customerName: page.znsRenewal?.params.customerName ?? "",
        plan: page.znsRenewal?.params.plan ?? "",
        endDate: page.znsRenewal?.params.endDate ?? "",
        amount: page.znsRenewal?.params.amount ?? "",
        transferContent: page.znsRenewal?.params.transferContent ?? "",
        invoiceNumber: page.znsRenewal?.params.invoiceNumber ?? "",
    }))
    const form: ZnsRenewalForm = useMemo(
        () => ({ ...("items" in stored ? stored.items : EMPTY_ZNS_FORM), ...draft }),
        [stored, draft],
    )

    const save = useCallback(async (): Promise<void> => {
        setNote("")
        const result = await settle(() => trigger({ connectionId, ...form }), t("znsSaved"))
        if (result.kind !== "ok") return setNote(labelOf(result.code, result.message))
        setDraft({})
        await mutate()
    }, [settle, trigger, connectionId, form, t, labelOf, mutate])

    return {
        slot: stored,
        form,
        change: (patch: Partial<ZnsRenewalForm>): void => setDraft((current) => ({ ...current, ...patch })),
        save,
        isSaving: isMutating,
        canEdit: role === "owner",
        note,
        reload: (): undefined => void mutate(),
    }
}
