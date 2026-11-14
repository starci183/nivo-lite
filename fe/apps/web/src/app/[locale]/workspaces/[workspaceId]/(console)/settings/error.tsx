"use client"

import { SettingsErrorPage } from "@/features/pages/SettingsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The settings route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <SettingsErrorPage onRetry={props.reset} />

export default ErrorBoundary
