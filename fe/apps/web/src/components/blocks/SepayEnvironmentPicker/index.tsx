"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useConnectionRefusal, useConnectionsRole } from "@/hooks/connections"
import { useSepayCommands, useSepayConnection, useSepaySetupStep } from "@/hooks/sepayConnection"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { SepayEnvironmentPickerBase, type SepayEnvironmentView } from "./component"

/** The connection addressed by this environment field. */
type SepayEnvironmentPickerProps = { readonly connectionId: string }

/** Only an owner can switch environments, after the connection's own read resolves. */
export const SepayEnvironmentPicker = (props: SepayEnvironmentPickerProps) => {
    const t = useTranslations("sepayConnection")
    const connection = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const { role } = useConnectionsRole()
    const slotLabels = useSlotLabels()
    const setup = useSepaySetupStep(props.connectionId, "environment")
    const [isPending, setPending] = useState(false)
    const [isAsking, setAsking] = useState(false)
    const slot = mapSlot(connection.slot, (view): SepayEnvironmentView => ({
        value: view.environment,
        description: t(view.environment === "test" ? "environmentTestNote" : "environmentLiveNote"),
        isDisabled: role !== "owner" || view.status === "disconnected" || isPending,
    }))
    const connectionView = "items" in connection.slot ? connection.slot.items : undefined
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayEnvironmentPickerBase
            props={{
                step: setup.step,
                label: t("stepEnvironment"),
                options: [
                    { value: "test", label: t("envTestShort") },
                    { value: "live", label: t("envLive") },
                ],
                slot,
                placeholder: { value: "test", description: t("environmentTestNote"), isDisabled: true },
                slotLabels: slotLabels(t("stepEnvironment")),
                confirm: {
                    isOpen: isAsking,
                    title: t("liveConfirmTitle"),
                    description: t("liveConfirmBody", { account: connectionView?.accountMasked ?? "" }),
                    confirmLabel: t("liveConfirmAction"),
                    cancelLabel: t("cancel"),
                    isPending,
                },
            }}
            on={{
                toggle: setup.toggle,
                retry: connection.retry,
                change: (environment) => {
                    if (environment === "live") return setAsking(true)
                    setPending(true)
                    void commands.setEnvironment(environment).then(() => setPending(false))
                },
                confirmLive: () => {
                    setPending(true)
                    void commands.setEnvironment("live").then(() => {
                        setPending(false)
                        setAsking(false)
                    })
                },
                dismiss: () => setAsking(false),
            }}
        />
    )
}
