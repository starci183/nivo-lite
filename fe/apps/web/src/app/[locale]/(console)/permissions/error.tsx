"use client"

import { TeamErrorPage } from "@/features/pages/TeamErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The permissions route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <TeamErrorPage selected="permissions" onRetry={props.reset} />

export default ErrorBoundary
