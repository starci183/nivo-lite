"use client"

import { AutomationsErrorPage } from "@/features/pages/AutomationsErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The automations error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AutomationsErrorPage onRetry={props.reset} />

export default ErrorBoundary
