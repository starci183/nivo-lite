"use client"

import { LandingGlobalErrorPage } from "@/features/pages/LandingGlobalErrorPage"
import "./globals.css"
import "@/modules/brand"

type GlobalErrorProps = { readonly reset: () => void }

/** The last-resort error boundary slot. */
const GlobalError = (props: GlobalErrorProps) => <LandingGlobalErrorPage onRetry={props.reset} />

export default GlobalError
