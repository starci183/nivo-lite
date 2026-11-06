import type { ReactNode } from "react"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"
import { ConsoleSession } from "@/components/providers/ConsoleSession"
import { PrototypeSession } from "@/components/providers/PrototypeSession"
import { isPrototypeMode } from "@/modules/config"

type LayoutProps = { readonly children: ReactNode }

/** The session gate, chosen once here: the real one waits for a usable session, a prototype build gives the fixture owner. */
const SessionGate = isPrototypeMode() ? PrototypeSession : ConsoleSession

/** Authenticated console route (the proxy already sent signed-out visitors to the login): the console frame around the page. */
const Layout = ({ children }: LayoutProps) => (
    <SessionGate>
        <ConsoleLayout>{children}</ConsoleLayout>
    </SessionGate>
)

export default Layout
