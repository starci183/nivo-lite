"use client"

import { KnowledgeErrorPage } from "@/features/pages/KnowledgeErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The document route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <KnowledgeErrorPage current="source" onRetry={props.reset} />

export default ErrorBoundary
