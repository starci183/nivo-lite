"use client"

import { LeadErrorPage } from "@/features/pages/LeadErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The lead error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <LeadErrorPage onRetry={props.reset} />

export default ErrorBoundary
