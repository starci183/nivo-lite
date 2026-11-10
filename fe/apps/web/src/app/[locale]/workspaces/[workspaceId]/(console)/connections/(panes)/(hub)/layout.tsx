import type { ReactNode } from "react"
import { ConnectionsLayout } from "@/features/layouts/ConnectionsLayout"

type LayoutProps = { readonly children: ReactNode }

/** The band of the Connections page: the one Page of its two tabs, Connected and Library. */
const Layout = (props: LayoutProps) => <ConnectionsLayout>{props.children}</ConnectionsLayout>

export default Layout
