"use client"

import { ZaloConnectionErrorPage } from "@/features/pages/ZaloConnectionErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The Zalo OA connection route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <ZaloConnectionErrorPage onRetry={props.reset} />

export default ErrorBoundary
