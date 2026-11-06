"use client"

import { LeadsErrorPage } from "@/features/pages/LeadsErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The leads error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <LeadsErrorPage onRetry={props.reset} />

export default ErrorBoundary
