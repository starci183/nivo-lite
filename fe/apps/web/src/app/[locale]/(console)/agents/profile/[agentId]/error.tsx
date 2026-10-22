"use client"

import { AgentProfileErrorPage } from "@/features/pages/AgentProfileErrorPage"

interface ErrorProps {
    readonly reset: () => void
}

/** The agent profile error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AgentProfileErrorPage onRetry={props.reset} />

export default ErrorBoundary
