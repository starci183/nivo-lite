"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { useSepayCommands, useSepayConnection } from "@/hooks/sepayConnection"
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
    const [isPending, setPending] = useState(false)
    const slot = mapSlot(connection.slot, (view): SepayEnvironmentView => ({
        value: view.environment,
        description: t(view.environment === "test" ? "environmentTestNote" : "environmentLiveNote"),
        isDisabled: role !== "owner" || view.status === "disconnected" || isPending,
    }))
    return (
        <SepayEnvironmentPickerBase
            props={{
                label: t("stepEnvironment"),
                options: [
                    { value: "test", label: t("envTestShort") },
                    { value: "live", label: t("envLive") },
                ],
                slot,
                placeholder: { value: "test", description: t("environmentTestNote"), isDisabled: true },
                slotLabels: slotLabels(t("stepEnvironment")),
            }}
            on={{
                retry: connection.retry,
                change: (environment) => {
                    setPending(true)
                    void commands.setEnvironment(environment).then(() => setPending(false))
                },
            }}
        />
    )
}
