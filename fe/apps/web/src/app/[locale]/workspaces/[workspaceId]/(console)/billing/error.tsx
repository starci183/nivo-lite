"use client"

import { CreditsErrorPage } from "@/features/pages/CreditsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The credits route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <CreditsErrorPage onRetry={props.reset} />

export default ErrorBoundary
