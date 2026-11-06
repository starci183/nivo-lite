"use client"

import { ConsoleErrorPage } from "@/features/pages/ConsoleErrorPage"

/** What Next hands the error boundary. */
interface ErrorProps {
    readonly reset: () => void
}

/** The console's last-resort error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <ConsoleErrorPage onRetry={props.reset} />

export default ErrorBoundary
