"use client"

import { DecisionsErrorPage } from "@/features/pages/DecisionsErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The decisions error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <DecisionsErrorPage onRetry={props.reset} />

export default ErrorBoundary
