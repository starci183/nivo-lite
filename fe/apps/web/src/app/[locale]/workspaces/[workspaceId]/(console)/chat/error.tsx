"use client"

import { TeamChatErrorPage } from "@/features/pages/TeamChatErrorPage"

/** What Next gives the error boundary: the retry. */
interface ErrorBoundaryProps {
    readonly reset: () => void
}

/** The team chat failure boundary. */
const ErrorBoundary = (props: ErrorBoundaryProps) => <TeamChatErrorPage onRetry={props.reset} />

export default ErrorBoundary
