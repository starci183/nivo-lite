"use client"

import { AuthorityErrorPage } from "@/features/pages/AuthorityErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The authority error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AuthorityErrorPage onRetry={props.reset} />

export default ErrorBoundary
