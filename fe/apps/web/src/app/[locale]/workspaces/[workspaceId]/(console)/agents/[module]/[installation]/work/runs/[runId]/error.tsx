"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The error boundary slot of the page of a run of an agent. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="work" onRetry={props.reset} />

export default ErrorBoundary
