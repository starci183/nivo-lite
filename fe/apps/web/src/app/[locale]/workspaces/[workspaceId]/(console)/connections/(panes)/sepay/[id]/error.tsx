"use client"

import { SepayConnectionErrorPage } from "@/features/pages/SepayConnectionErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The SePay connection route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <SepayConnectionErrorPage onRetry={props.reset} />

export default ErrorBoundary
