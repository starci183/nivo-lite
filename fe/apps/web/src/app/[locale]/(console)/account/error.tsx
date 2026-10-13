"use client"

import { AccountErrorPage } from "@/features/pages/AccountErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The account route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AccountErrorPage onRetry={props.reset} />

export default ErrorBoundary
