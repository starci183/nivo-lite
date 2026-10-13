import type { ReactNode } from "react"
import { ConsoleLayout } from "@/features/layouts/ConsoleLayout"

type LayoutProps = { readonly children: ReactNode }

/** Authenticated console route (the proxy already sent signed-out visitors to the login): the console frame around the page. */
const Layout = ({ children }: LayoutProps) => <ConsoleLayout>{children}</ConsoleLayout>

export default Layout
