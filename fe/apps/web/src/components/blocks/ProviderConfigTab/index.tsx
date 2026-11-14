"use client"

import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { ProviderConfigTabBase } from "./component"

/** What the page hands the tab: the account of the address. */
interface ProviderConfigTabProps {
    readonly connectionId: string
}

/** The Config tab of a connected account: it reads the account's provider and draws that provider's content in the template's two columns. */
export const ProviderConfigTab = (props: ProviderConfigTabProps) => {
    const open = useConnectionOpenPage()
    return <ProviderConfigTabBase props={{ connectionId: props.connectionId, provider: open.provider }} />
}
