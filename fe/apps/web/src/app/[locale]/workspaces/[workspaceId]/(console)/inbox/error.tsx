"use client"

import { InboxErrorPage } from "@/features/pages/InboxErrorPage"

/** What Next gives the error boundary: the retry. */
interface ErrorBoundaryProps {
    readonly reset: () => void
}

/** The Inbox failure boundary. */
const ErrorBoundary = (props: ErrorBoundaryProps) => <InboxErrorPage onRetry={props.reset} />

export default ErrorBoundary
