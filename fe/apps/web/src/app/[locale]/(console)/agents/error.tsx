"use client"

import { AgentsErrorPage } from "@/features/pages/AgentsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The error boundary slot of the frame of an agent. */
const ErrorBoundary = (props: ErrorProps) => <AgentsErrorPage scope="frame" onRetry={props.reset} />

export default ErrorBoundary
