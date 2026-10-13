"use client"

import { AdminHealthErrorPage } from "@/features/pages/AdminHealthErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The platform health route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AdminHealthErrorPage onRetry={props.reset} />

export default ErrorBoundary
