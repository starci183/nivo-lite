"use client"

import { AdminWorkspacesErrorPage } from "@/features/pages/AdminWorkspacesErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The admin workspace list's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AdminWorkspacesErrorPage onRetry={props.reset} />

export default ErrorBoundary
