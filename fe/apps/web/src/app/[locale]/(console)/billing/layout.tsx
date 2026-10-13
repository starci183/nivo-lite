import type { ReactNode } from "react"
import { CreditsLayout } from "@/features/layouts/CreditsLayout"

interface LayoutProps {
    readonly children: ReactNode
}

/** The shared credits frame around the page and its loading state. */
const Layout = ({ children }: LayoutProps) => <CreditsLayout>{children}</CreditsLayout>

export default Layout
