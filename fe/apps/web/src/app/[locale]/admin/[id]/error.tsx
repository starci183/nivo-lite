"use client"

import { AdminWorkspaceErrorPage } from "@/features/pages/AdminWorkspaceErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The workspace overview route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AdminWorkspaceErrorPage onRetry={props.reset} />

export default ErrorBoundary
