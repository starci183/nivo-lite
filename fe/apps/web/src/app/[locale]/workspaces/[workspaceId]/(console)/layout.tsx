import type { ReactElement, ReactNode } from "react"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"
import { ConsoleSession } from "@/components/providers/ConsoleSession"
import { PrototypeSession } from "@/components/providers/PrototypeSession"
import { WorkspaceTheme } from "@/components/providers/WorkspaceTheme"
import { isPrototypeMode } from "@/modules/config"
import { themeBootScript } from "@/modules/brand"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly workspaceId: string }>
}

/** The session gate, chosen once here: the real one waits for a usable session, a prototype build gives the fixture owner. */
const SessionGate = isPrototypeMode() ? PrototypeSession : ConsoleSession

/**
 * Authenticated console route (the proxy already sent signed-out visitors to the login): the console frame around the page, in the
 * workspace's own theme. The inline script paints the theme this browser kept for the workspace before the first paint (its text is built
 * from the route's workspace id alone); the provider then reads and applies the saved one.
 */
const Layout = async (props: LayoutProps): Promise<ReactElement> => (
    <>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript((await props.params).workspaceId) }} />
        <SessionGate>
            <WorkspaceTheme />
            <ConsoleLayout>{props.children}</ConsoleLayout>
        </SessionGate>
    </>
)

export default Layout
