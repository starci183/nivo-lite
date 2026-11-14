"use client"

import { useParams } from "next/navigation"
import type { ReactElement } from "react"
import type { ProviderPageTab } from "@/modules/types"
import { ConnectionOpenPageBase } from "./component"

/** The tab a loading boundary draws. */
interface ConnectionOpenAddressBodyProps {
    readonly tab: ProviderPageTab
}

/** The body of a connection page for a boundary that knows no address: the id comes from the browser's address. */
export const ConnectionOpenAddressBody = (props: ConnectionOpenAddressBodyProps): ReactElement => {
    const params = useParams<{ id?: string }>()
    return <ConnectionOpenPageBase props={{ tab: props.tab, connectionId: typeof params.id === "string" ? params.id : "" }} />
}
