"use client"

import { OverviewErrorPage } from "@/features/pages/OverviewErrorPage"

/** What Next gives the error boundary: the retry. */
interface ErrorBoundaryProps {
    readonly reset: () => void
}

/** The overview failure boundary. */
const ErrorBoundary = (props: ErrorBoundaryProps) => <OverviewErrorPage onRetry={props.reset} />

export default ErrorBoundary
