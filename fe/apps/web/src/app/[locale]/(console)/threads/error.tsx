"use client"

import { WorkThreadsErrorPage } from "@/features/pages/WorkThreadsErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The work threads error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <WorkThreadsErrorPage onRetry={props.reset} />

export default ErrorBoundary
