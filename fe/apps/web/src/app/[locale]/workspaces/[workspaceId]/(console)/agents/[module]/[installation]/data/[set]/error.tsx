"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The error boundary slot of a data page of an agent. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="workbench" onRetry={props.reset} />

export default ErrorBoundary
