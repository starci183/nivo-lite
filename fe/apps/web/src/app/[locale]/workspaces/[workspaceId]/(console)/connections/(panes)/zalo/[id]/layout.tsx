import type { ReactNode } from "react"
import { ZaloConnectionLayout } from "@/features/layouts/ZaloConnectionLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly id: string }>
}

/** The band of a Zalo OA connection page: the one Page of every tab under it. */
const Layout = (props: LayoutProps) => (
    <ZaloConnectionLayout params={props.params}>{props.children}</ZaloConnectionLayout>
)

export default Layout
