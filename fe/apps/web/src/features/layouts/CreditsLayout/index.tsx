import type { ReactNode } from "react"

interface CreditsLayoutProps {
    readonly children: ReactNode
}

/** The credits route frame places no region of its own: the page and its loading state each draw their one Page. */
export const CreditsLayout = (props: CreditsLayoutProps) => <>{props.children}</>
