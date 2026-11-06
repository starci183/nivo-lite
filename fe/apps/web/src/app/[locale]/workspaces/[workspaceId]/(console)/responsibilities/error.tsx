"use client"

import { ResponsibilitiesErrorPage } from "@/features/pages/ResponsibilitiesErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The responsibilities error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <ResponsibilitiesErrorPage onRetry={props.reset} />

export default ErrorBoundary
