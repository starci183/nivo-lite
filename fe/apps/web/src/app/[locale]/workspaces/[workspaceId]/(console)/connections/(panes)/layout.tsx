import type { ReactNode } from "react"
import { ConnectionsLayout } from "@/features/layouts/ConnectionsLayout"

type LayoutProps = { readonly children: ReactNode }

/** The frame slot of the Connections pages: the list of connections with the routed page beside it. */
const Layout = (props: LayoutProps) => <ConnectionsLayout>{props.children}</ConnectionsLayout>

export default Layout
