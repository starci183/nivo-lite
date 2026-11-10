import type { ReactElement, ReactNode } from "react"
import { ZaloConnectionLayoutBase } from "./component"

/** What the route hands the layout: its path and the routed tab. */
type ZaloConnectionLayoutProps = {
    readonly children?: ReactNode
    readonly params: Promise<{ readonly id: string }>
}

/** The frame of every tab of a Zalo OA connection page: the band stays while the tab's body changes. */
export const ZaloConnectionLayout = async (props: ZaloConnectionLayoutProps): Promise<ReactElement> => {
    const { id } = await props.params
    return <ZaloConnectionLayoutBase props={{ connectionId: id }}>{props.children}</ZaloConnectionLayoutBase>
}
