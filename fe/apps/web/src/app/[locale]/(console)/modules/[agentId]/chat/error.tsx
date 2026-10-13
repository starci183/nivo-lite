"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

/** What Next hands the error boundary. */
interface ErrorProps {
    readonly reset: () => void
}

/** STATE-8 case-4: an agent route whose data fails keeps its trail and the agents heading, with one Alert and a retry. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="frame" onRetry={props.reset} />

export default ErrorBoundary
