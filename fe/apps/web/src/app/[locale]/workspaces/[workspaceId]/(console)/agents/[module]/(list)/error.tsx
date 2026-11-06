"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The error boundary slot of the list of the instances of a type. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="list" onRetry={props.reset} />

export default ErrorBoundary
