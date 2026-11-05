"use client"

import { useTranslations } from "next-intl"
import { useConnectionOpen } from "@/hooks/connectionsPanes"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ConnectionOpenBase } from "./component"

/** The connection the address opens. */
interface ConnectionOpenProps {
    readonly connectionId: string
}

/** The detail pane of a connection that has no page of its own: its view and commands are the ones its row has in a drawer. */
export const ConnectionOpen = (props: ConnectionOpenProps) => {
    const t = useTranslations("connections")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const labels = useSlotLabels()
    const open = useConnectionOpen(props.connectionId)
    return (
        <ConnectionOpenBase
            props={{
                gridLabel: t("title"),
                mainLabel: t("openLabel"),
                backLabel: pane.backToList,
                moreLabel: pane.moreActions,
                slot: open.slot,
                placeholder: open.placeholder,
                labels: labels(t("connectedEmpty")),
            }}
            on={{ ...open.on, back: () => router.push(CONSOLE_ROUTES.connections), retry: open.retry }}
        />
    )
}
