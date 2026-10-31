"use client"

import { useTranslations } from "next-intl"
import { useBankName } from "@/hooks/banks"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useConnectionsRole } from "@/hooks/connections"
import { bankOptions } from "@/hooks/money-wizard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    useSepayAccountForm,
    useSepayCommands,
    useSepayConnection,
    useSepayPlaceholder,
    useSepayRotate,
    useSepaySettings,
} from "@/hooks/sepayConnection"
import type { SepayConnectionView } from "@/modules/types"
import { SepaySetupBase } from "./component"
import type { SepaySetupView } from "./component"

/** What the page hands a setup step: the connection of the url and which part of the setup it draws. */
type SepaySetupProps = {
    readonly connectionId: string
    /** `paste`: the webhook to create on SePay; `account`: the bank account form. */
    readonly part: "paste" | "account"
}

/** The connected SePay setup parts: the webhook address, masked key and settings to set on SePay, or the bank account form. */
export const SepaySetup = (props: SepaySetupProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const copy = useCopyLabels()
    const bankName = useBankName()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const placeholder = useSepayPlaceholder()
    const { role } = useConnectionsRole()
    const rotate = useSepayRotate(commands.rotateKey)
    const connection = slot.items
    const account = useSepayAccountForm(connection, commands.saveAccount)
    const settings = useSepaySettings(connection)
    const viewOf = (items: SepayConnectionView): SepaySetupView => ({
        webhookUrl: items.webhookUrl,
        apiKeyMasked: items.apiKeyMasked,
        accountHint: items.hasFullAccount
            ? t("accountKept", { account: items.accountMasked })
            : t("accountMissing", { account: items.accountMasked }),
    })
    return (
        <SepaySetupBase
            shape={props.part}
            props={{
                slot: mapSlot(slot, viewOf),
                placeholder: viewOf(placeholder),
                labels: slotLabels(t("loadFailed")),
                copyLabel: copy.copy,
                copiedLabel: copy.copied,
                copyErrorLabel: t("copyFailed"),
                webhookLabel: t("webhookLabel"),
                keyLabel: t("keyLabel"),
                keyNote: t("keyNote"),
                settingsLabel: t("settingsLabel"),
                settings,
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
                rotate: {
                    label: t("rotateKey"),
                    isOpen: rotate.isAsking,
                    title: t("rotateTitle"),
                    description: t("rotateBody"),
                    confirmLabel: t("rotateConfirm"),
                    cancelLabel: t("cancel"),
                    isPending: rotate.isRotating,
                },
            }}
            on={{
                retry,
                copyKey: async () => {
                    const settled = await commands.revealKey()
                    if (settled.kind !== "ok") throw new Error(settled.message)
                    return settled.value
                },
                askRotate: rotate.ask,
                dismissRotate: rotate.dismiss,
                confirmRotate: rotate.confirm,
                ...account.on,
            }}
        />
    )
}
