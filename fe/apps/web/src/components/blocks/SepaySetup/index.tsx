"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useBankName } from "@/hooks/banks"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useConnectionsRole } from "@/hooks/connections"
import { bankOptions } from "@/hooks/money-wizard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useSepayCommands, useSepayConnection, useSepayPlaceholder } from "@/hooks/sepayConnection"
import type { SepayAccountForm, SepayConnectionView } from "@/modules/types"
import { SepaySetupBase } from "./component"
import type { SepaySetupView } from "./component"

/** What the page hands the Setup tab: the connection of the url. */
type SepaySetupProps = { readonly connectionId: string }

/** The connected Setup tab: the webhook address and masked key to paste into SePay, and the bank account form. */
export const SepaySetup = (props: SepaySetupProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const copy = useCopyLabels()
    const bankName = useBankName()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const placeholder = useSepayPlaceholder()
    const { role } = useConnectionsRole()
    const [draft, setDraft] = useState<Partial<SepayAccountForm>>({})
    const [isPending, setPending] = useState(false)
    const connection = slot.items
    const form: SepayAccountForm = {
        bank: draft.bank ?? connection?.bankCode ?? "",
        account: draft.account ?? "",
        holder: draft.holder ?? connection?.holder ?? "",
    }
    const viewOf = (items: SepayConnectionView): SepaySetupView => ({
        webhookUrl: items.webhookUrl,
        apiKeyMasked: items.apiKeyMasked,
        accountHint: items.hasFullAccount
            ? t("accountKept", { account: items.accountMasked })
            : t("accountMissing", { account: items.accountMasked }),
    })
    return (
        <SepaySetupBase
            props={{
                slot: mapSlot(slot, viewOf),
                placeholder: viewOf(placeholder),
                labels: slotLabels(t("loadFailed")),
                copy,
                pasteTitle: t("pasteTitle"),
                webhookLabel: t("webhookLabel"),
                keyLabel: t("keyLabel"),
                copyKeyLabel: t("copyKey"),
                factsLine: t("pasteFacts"),
                accountTitle: t("accountTitle"),
                bankLabel: t("bankLabel"),
                bankPlaceholder: t("bankPlaceholder"),
                bankOptions: bankOptions(bankName),
                accountLabel: t("accountLabel"),
                holderLabel: t("holderLabel"),
                saveLabel: t("saveAccount"),
                form,
                canEdit: role === "owner",
                isPending,
            }}
            on={{
                retry,
                copyKey: () => {
                    void commands.revealKey().then(async (settled) => {
                        if (settled.kind === "ok") await navigator.clipboard.writeText(settled.value)
                    })
                },
                bank: (bank) => setDraft((current) => ({ ...current, bank })),
                account: (account) => setDraft((current) => ({ ...current, account })),
                holder: (holder) => setDraft((current) => ({ ...current, holder })),
                save: () => {
                    if (connection === undefined) return
                    setPending(true)
                    void commands.saveAccount(connection, form).then((settled) => {
                        setPending(false)
                        if (settled.kind === "ok") setDraft({})
                    })
                },
            }}
        />
    )
}
