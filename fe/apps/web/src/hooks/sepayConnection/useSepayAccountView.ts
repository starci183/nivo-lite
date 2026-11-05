"use client"

import { useTranslations } from "next-intl"
import { useBankName } from "@/hooks/banks"
import { useConnectionsRole } from "@/hooks/connections"
import { bankOptions } from "@/hooks/money-wizard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SepayAccountForm, SlotLabels } from "@/modules/types"
import { useSepayAccountForm } from "./useSepayAccountForm"
import { useSepayCommands } from "./useSepayCommands"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPlaceholder } from "./useSepayPlaceholder"

/** What the bank account step of a SePay connection draws, and the commands behind it. */
interface SepayAccountView {
    readonly view: {
        readonly slot: DataSlot<{ readonly accountHint: string }>
        readonly placeholder: { readonly accountHint: string }
        readonly labels: SlotLabels
        readonly accountTitle: string
        readonly bankLabel: string
        readonly bankPlaceholder: string
        readonly bankOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly accountLabel: string
        readonly holderLabel: string
        readonly saveLabel: string
        readonly form: SepayAccountForm
        readonly canEdit: boolean
        readonly isPending: boolean
    }
    readonly on: ReturnType<typeof useSepayAccountForm>["on"]
}

/** The bank account whose full number a VietQR needs: its form, its words and whether the viewer may change it. */
export const useSepayAccountView = (connectionId: string): SepayAccountView => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const bankName = useBankName()
    const { slot } = useSepayConnection(connectionId)
    const commands = useSepayCommands(connectionId)
    const placeholder = useSepayPlaceholder()
    const { role } = useConnectionsRole()
    const connection = "items" in slot ? slot.items : undefined
    const account = useSepayAccountForm(connection, commands.saveAccount)
    const hintOf = (accountMasked: string, hasFullAccount: boolean): { readonly accountHint: string } => ({
        accountHint: hasFullAccount
            ? t("accountKept", { account: accountMasked })
            : t("accountMissing", { account: accountMasked }),
    })
    return {
        view: {
            slot: mapSlot(slot, (item) => hintOf(item.accountMasked, item.hasFullAccount)),
            placeholder: hintOf(placeholder.accountMasked, placeholder.hasFullAccount),
            labels: slotLabels(t("loadFailed")),
            accountTitle: t("accountTitle"),
            bankLabel: t("bankLabel"),
            bankPlaceholder: t("bankPlaceholder"),
            bankOptions: bankOptions(bankName),
            accountLabel: t("accountLabel"),
            holderLabel: t("holderLabel"),
            saveLabel: t("saveAccount"),
            form: account.form,
            canEdit: role === "owner" && connection?.status !== "disconnected",
            isPending: account.isPending,
        },
        on: account.on,
    }
}
