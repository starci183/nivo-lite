"use client"

import { useTranslations } from "next-intl"
import { useConnectionOverlays } from "@/hooks/connections"
import type { Provider } from "@/modules/types"
import { ConnectionAddButtonBase } from "./component"

/** What the list that offers the command hands it. */
type ConnectionAddButtonProps = {
    readonly provider: Provider
    /** "add" for a provider that already has connections, "connect" for one that has none. */
    readonly kind: "add" | "connect"
}

/** Opens the wizard of one provider through the URL. */
export const ConnectionAddButton = (props: ConnectionAddButtonProps) => {
    const t = useTranslations("connections")
    const overlays = useConnectionOverlays()
    return (
        <ConnectionAddButtonBase
            props={{
                label: props.kind === "add" ? t("add") : t("connect"),
                variant: props.kind === "add" ? "ghost" : "outline",
            }}
            on={{ press: () => overlays.openWizard(props.provider) }}
        />
    )
}
