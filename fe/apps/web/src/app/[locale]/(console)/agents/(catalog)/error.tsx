"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The catalogue error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="catalog" onRetry={props.reset} />

export default ErrorBoundary
