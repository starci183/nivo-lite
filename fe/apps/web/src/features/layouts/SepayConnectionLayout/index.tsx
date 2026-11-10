import type { ReactElement, ReactNode } from "react"
import { SepayConnectionLayoutBase } from "./component"

/** What the route hands the layout: its path and the routed tab. */
type SepayConnectionLayoutProps = {
    readonly children?: ReactNode
    readonly params: Promise<{ readonly id: string }>
}

/** The frame of every tab of a SePay connection page: the band stays while the tab's body changes. */
export const SepayConnectionLayout = async (props: SepayConnectionLayoutProps): Promise<ReactElement> => {
    const { id } = await props.params
    return <SepayConnectionLayoutBase props={{ connectionId: id }}>{props.children}</SepayConnectionLayoutBase>
}
