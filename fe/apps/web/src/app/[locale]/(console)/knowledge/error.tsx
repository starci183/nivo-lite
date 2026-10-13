"use client"

import { KnowledgeErrorPage } from "@/features/pages/KnowledgeErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The documents route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <KnowledgeErrorPage onRetry={props.reset} />

export default ErrorBoundary
