"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The error boundary slot of the performance tab of an agent. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="performance" onRetry={props.reset} />

export default ErrorBoundary
