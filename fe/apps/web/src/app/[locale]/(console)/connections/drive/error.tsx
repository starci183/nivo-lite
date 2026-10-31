"use client"

import { DriveConnectionErrorPage } from "@/features/pages/DriveConnectionErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The Google Drive route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <DriveConnectionErrorPage onRetry={props.reset} />

export default ErrorBoundary
