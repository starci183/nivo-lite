import type { ReactNode } from "react"
import { DriveConnectionLayout } from "@/features/layouts/DriveConnectionLayout"

type LayoutProps = { readonly children: ReactNode }

/** Adapts the Google Drive route to its layout: the band and the tabs around the routed page. */
const Layout = (props: LayoutProps) => <DriveConnectionLayout>{props.children}</DriveConnectionLayout>

export default Layout
