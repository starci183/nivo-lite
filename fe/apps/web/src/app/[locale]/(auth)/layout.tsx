import type { ReactNode } from "react"
import { AuthLayout } from "@/features/layouts/AuthLayout"

type LayoutProps = { readonly children: ReactNode }

/** Public auth routes (sign in, sign up, forgot and reset password) share the centred entry screen. */
const Layout = ({ children }: LayoutProps) => <AuthLayout>{children}</AuthLayout>

export default Layout
