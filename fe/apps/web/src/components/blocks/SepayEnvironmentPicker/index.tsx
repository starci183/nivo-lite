"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { useSepayCommands, useSepayConnection } from "@/hooks/sepayConnection"
import { SepayEnvironmentPickerBase } from "./component"

/** What the page hands the step body: the connection of the url. */
type SepayEnvironmentPickerProps = { readonly connectionId: string }

/** The connected environment switch of a SePay connection: test books nothing, live books every credit; only the owner switches. */
export const SepayEnvironmentPicker = (props: SepayEnvironmentPickerProps) => {
    const t = useTranslations("sepayConnection")
    const { slot } = useSepayConnection(props.connectionId)
    const commands = useSepayCommands(props.connectionId)
    const { role } = useConnectionsRole()
    const [isPending, setPending] = useState(false)
    const value = slot.items?.environment ?? "test"
    return (
        <SepayEnvironmentPickerBase
            props={{
                label: t("stepEnvironment"),
                description: t(value === "test" ? "environmentTestNote" : "environmentLiveNote"),
                value,
                options: [
                    { value: "test", label: t("envTestShort") },
                    { value: "live", label: t("envLive") },
                ],
                isDisabled: role !== "owner" || slot.items === undefined || isPending,
                isSkeleton: slot.items === undefined,
            }}
            on={{
                change: (environment) => {
                    if (environment === value) return
                    setPending(true)
                    void commands.setEnvironment(environment).then(() => setPending(false))
                },
            }}
        />
    )
}
