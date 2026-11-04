"use client"

import { useTranslations } from "next-intl"
import { useConnectionGrants } from "@/hooks/connectionsPanes"
import { useSlotLabels } from "@/hooks/slot"
import { ConnectionGrantsBase } from "./component"

/** The connection whose page asks for its agents. */
interface ConnectionGrantsProps {
    readonly connectionId: string
}

/** The agents of one connection: the agents of one connection with their levels, read from the workspace and saved one pair at a time. */
export const ConnectionGrants = (props: ConnectionGrantsProps) => {
    const t = useTranslations("connections")
    const labels = useSlotLabels()
    const grants = useConnectionGrants(props.connectionId)
    return (
        <ConnectionGrantsBase
            props={{
                title: t("grantsTitle"),
                assignLabel: t("grantAssign"),
                emptyMessage: t("grantsEmpty"),
                slot: grants.slot,
                labels: labels(t("grantsEmpty")),
            }}
            on={{ pick: grants.pick, assign: grants.assign, retry: grants.retry }}
        />
    )
}
