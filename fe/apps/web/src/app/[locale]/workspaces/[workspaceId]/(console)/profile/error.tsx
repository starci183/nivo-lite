"use client"

import { AccountErrorPage } from "@/features/pages/AccountErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The profile route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AccountErrorPage selected="profile" onRetry={props.reset} />

export default ErrorBoundary
