import type { ReactNode } from "react"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"
import { ConsoleSession } from "@/components/providers/ConsoleSession"

type LayoutProps = { readonly children: ReactNode }

/** Authenticated console route (the proxy already sent signed-out visitors to the login): the console frame around the page. */
const Layout = ({ children }: LayoutProps) => (
    <ConsoleSession>
        <ConsoleLayout>{children}</ConsoleLayout>
    </ConsoleSession>
)

export default Layout
