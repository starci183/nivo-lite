"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The error boundary slot of the AgentTemplates page. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="catalog" onRetry={props.reset} />

export default ErrorBoundary
