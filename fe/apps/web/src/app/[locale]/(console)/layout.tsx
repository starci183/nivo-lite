import type { ReactNode } from "react"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"
import { ConsoleSession } from "@/components/providers/ConsoleSession"
import { isPrototypeMode } from "@/modules/config"

type LayoutProps = { readonly children: ReactNode }

/** What the session gate wraps. */
type GateProps = { readonly children: ReactNode }

/** A prototype build has no back end to sign in to: the console frame draws around the fixtures without a session gate. */
const OpenSession = (props: GateProps) => props.children

/** The session gate, chosen once here: the real one waits for a usable session, a prototype build lets the frame through. */
const SessionGate = isPrototypeMode() ? OpenSession : ConsoleSession

/** Authenticated console route (the proxy already sent signed-out visitors to the login): the console frame around the page. */
const Layout = ({ children }: LayoutProps) => (
    <SessionGate>
        <ConsoleLayout>{children}</ConsoleLayout>
    </SessionGate>
)

export default Layout
