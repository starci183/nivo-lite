"use client"

import { KnowledgeErrorPage } from "@/features/pages/KnowledgeErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The questions route's error boundary slot: the knowledge trail with one alert and a retry. */
const ErrorBoundary = (props: ErrorProps) => <KnowledgeErrorPage current="questions" onRetry={props.reset} />

export default ErrorBoundary
