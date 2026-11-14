"use client"

import { SandboxErrorPage } from "@/features/pages/SandboxErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The sandbox route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <SandboxErrorPage onRetry={props.reset} />

export default ErrorBoundary
