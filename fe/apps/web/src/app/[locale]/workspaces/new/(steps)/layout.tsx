import type { ReactNode } from "react"
import { FirstRunLayout } from "@/features/layouts/FirstRunLayout"

type LayoutProps = { readonly children: ReactNode }

/** The steps of the first-run wizard share one workspaces bar; the payment route keeps its own frame. */
const Layout = ({ children }: LayoutProps) => <FirstRunLayout>{children}</FirstRunLayout>

export default Layout
