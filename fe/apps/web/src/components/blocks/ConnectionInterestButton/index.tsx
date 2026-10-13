"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useWantConnector } from "@/hooks/connections"
import { ConnectionInterestButtonBase } from "./component"

/** What the detail of a planned connector hands the command. */
type ConnectionInterestButtonProps = {
    readonly connectorId: string
}

/** "I want it" on a planned connector (owner or manager): recorded once per workspace, so the button stays pressed once it worked. */
export const ConnectionInterestButton = (props: ConnectionInterestButtonProps) => {
    const t = useTranslations("connections")
    const want = useWantConnector()
    const [isPending, startTransition] = useTransition()
    const [wanted, setWanted] = useState(false)
    const [note, setNote] = useState<string | undefined>(undefined)
    const press = () =>
        startTransition(async () => {
            const result = await want(props.connectorId)
            if (result.kind === "ok") setWanted(true)
            else setNote(result.message)
        })
    return (
        <ConnectionInterestButtonBase
            props={{ label: t("detailWant"), isDisabled: wanted, isPending, ...(note === undefined ? {} : { note }) }}
            on={{ press }}
        />
    )
}
