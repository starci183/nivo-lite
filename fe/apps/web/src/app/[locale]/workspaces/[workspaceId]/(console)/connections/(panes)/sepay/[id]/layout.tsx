import type { ReactNode } from "react"
import { SepayConnectionLayout } from "@/features/layouts/SepayConnectionLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly id: string }>
}

/** The band of a SePay connection page: the one Page of every tab under it. */
const Layout = (props: LayoutProps) => (
    <SepayConnectionLayout params={props.params}>{props.children}</SepayConnectionLayout>
)

export default Layout
