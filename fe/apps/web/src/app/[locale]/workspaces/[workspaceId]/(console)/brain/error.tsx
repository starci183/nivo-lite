"use client"

import { BrainErrorPage } from "@/features/pages/BrainErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The Second Brain route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <BrainErrorPage onRetry={props.reset} />

export default ErrorBoundary
