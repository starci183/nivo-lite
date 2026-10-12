"use client"

import { AppGlobalErrorPage } from "@/features/pages/AppGlobalErrorPage"
import "./globals.css"

type GlobalErrorProps = { readonly reset: () => void }

/** The last-resort error boundary slot (it replaces the document, so it brings its own). */
const GlobalError = (props: GlobalErrorProps) => <AppGlobalErrorPage onRetry={props.reset} />

export default GlobalError
