"use client"

import { ConnectionsErrorPage } from "@/features/pages/ConnectionsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The Connections route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <ConnectionsErrorPage onRetry={props.reset} />

export default ErrorBoundary
