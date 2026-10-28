"use client"

import { ConnectionsErrorPage } from "@/features/pages/ConnectionsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The SePay connection route error boundary slot: the Connections trail and a retry. */
const ErrorBoundary = (props: ErrorProps) => <ConnectionsErrorPage onRetry={props.reset} />

export default ErrorBoundary
