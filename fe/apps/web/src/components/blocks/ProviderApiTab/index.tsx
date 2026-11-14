"use client"

import { CrmApiTab } from "@/components/blocks/CrmApiTab"
import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { useProviderDocLevel } from "@/hooks/providerOffer"
import { useSlotLabels } from "@/hooks/slot"
import { ProviderApiTabBase } from "./component"

/** What the page hands the tab: the account of the address. */
interface ProviderApiTabProps {
    readonly connectionId: string
}

/**
 * The Api tab of a connected account's page: the reads a screen calls (level 1), documented from the registry through `providerOffer`;
 * a CRM connected by Swagger shows the operations its pinned snapshot generates instead.
 */
export const ProviderApiTab = (props: ProviderApiTabProps) => {
    const slotLabels = useSlotLabels()
    const read = useProviderDocLevel("api")
    const open = useConnectionOpenPage()
    if (open.provider === "openapi") return <CrmApiTab connectionId={props.connectionId} />
    return (
        <ProviderApiTabBase
            props={{ level: read.level, words: read.words, slotLabels: slotLabels(read.level.empty) }}
            on={{ retry: read.retry }}
        />
    )
}
