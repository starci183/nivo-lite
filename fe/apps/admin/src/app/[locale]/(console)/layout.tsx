import type { ReactNode } from "react"
import { AdminLayout } from "@/features/layouts/AdminLayout"

export { adminLayoutMetadata as generateMetadata } from "@/features/layouts/AdminLayout"

/** The console is read per request under the admin token, never prerendered. */
export const dynamic = "force-dynamic"

type LayoutProps = { readonly children: ReactNode }

/** The team console: the frame checks the platform admin, every page reads under the same token. */
const Layout = (props: LayoutProps) => <AdminLayout>{props.children}</AdminLayout>

export default Layout
