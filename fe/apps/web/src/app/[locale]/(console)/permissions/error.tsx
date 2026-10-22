"use client"

import { PermissionsErrorPage } from "@/features/pages/PermissionsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The permissions route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <PermissionsErrorPage onRetry={props.reset} />

export default ErrorBoundary
