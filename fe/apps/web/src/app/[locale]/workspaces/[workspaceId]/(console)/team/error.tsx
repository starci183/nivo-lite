"use client"

import { TeamErrorPage } from "@/features/pages/TeamErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The team route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <TeamErrorPage onRetry={props.reset} />

export default ErrorBoundary
