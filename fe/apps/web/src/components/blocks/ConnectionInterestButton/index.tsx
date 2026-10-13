"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeConnectorInterest } from "@/modules/api/connections/write-connector-interest"
import { ConnectionInterestButtonBase } from "./component"

/** What the detail of a planned connector hands the command. */
type ConnectionInterestButtonProps = {
    readonly workspaceId: string
    readonly connectorId: string
}

/** "I want it" on a planned connector (owner or manager): recorded once per workspace, so the button stays pressed once it worked. */
export const ConnectionInterestButton = (props: ConnectionInterestButtonProps) => {
    const t = useTranslations("connections")
    const [isPending, startTransition] = useTransition()
    const [wanted, setWanted] = useState(false)
    const [note, setNote] = useState<string | undefined>(undefined)
    const press = () =>
        startTransition(async () => {
            const result = await writeConnectorInterest({
                workspaceId: props.workspaceId,
                connectorId: props.connectorId,
            })
            setNote(result.kind === "ok" ? t("detailWanted") : t(result.fault.code))
            if (result.kind === "ok") setWanted(true)
        })
    return (
        <ConnectionInterestButtonBase
            props={{ label: t("detailWant"), isDisabled: wanted, isPending, ...(note === undefined ? {} : { note }) }}
            on={{ press }}
        />
    )
}
