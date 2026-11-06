import type { ReactNode } from "react"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"

/** What the route layout wraps. */
interface LayoutProps {
    readonly children: ReactNode
}

/** The developers route: the page, and the connection wizard drawer its webhook rows open through the URL. */
const Layout = (props: LayoutProps) => (
    <>
        {props.children}
        <ConnectionWizardOverlay />
    </>
)

export default Layout
