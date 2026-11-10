import type { ReactNode } from "react"
import { ConnectionOpenLayout } from "@/features/layouts/ConnectionOpenLayout"

type LayoutProps = { readonly children: ReactNode }

/** The band of a connection page without a provider page: the one Page of every tab under it. */
const Layout = (props: LayoutProps) => <ConnectionOpenLayout>{props.children}</ConnectionOpenLayout>

export default Layout
