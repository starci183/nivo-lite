"use client"

import { KnowledgeErrorPage } from "@/features/pages/KnowledgeErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The base knowledge route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <KnowledgeErrorPage current="nivo" onRetry={props.reset} />

export default ErrorBoundary
