import type { ReactNode } from "react"
import { FirstRunGate } from "@/components/providers/FirstRunGate"
import { FirstRunLayout } from "@/features/layouts/FirstRunLayout"

type LayoutProps = { readonly children: ReactNode }

/** The steps of the first-run wizard share one workspaces bar; the payment route keeps its own frame. A step after the first without its `ws` goes back to the lobby. */
const Layout = ({ children }: LayoutProps) => (
    <FirstRunLayout>
        <FirstRunGate>{children}</FirstRunGate>
    </FirstRunLayout>
)

export default Layout
