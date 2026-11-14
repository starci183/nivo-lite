"use client"

import { ContactsErrorPage } from "@/features/pages/ContactsErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The contacts route's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <ContactsErrorPage onRetry={props.reset} />

export default ErrorBoundary
