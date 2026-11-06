"use client"

import { TelegramConnectionErrorPage } from "@/features/pages/TelegramConnectionErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The Telegram bot connection route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <TelegramConnectionErrorPage onRetry={props.reset} />

export default ErrorBoundary
