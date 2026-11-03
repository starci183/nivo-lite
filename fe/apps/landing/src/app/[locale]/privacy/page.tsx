import { LegalPage, legalMetadata } from "@/features/pages/LegalPage"

import type { ReactElement } from "react"
import type { Metadata } from "next"

/** The document title of the privacy policy. */
export const generateMetadata = (): Promise<Metadata> => legalMetadata("privacy")

/** Public privacy policy (listed in src/proxy.ts PUBLIC_PATHS). */
const Page = (): ReactElement => <LegalPage doc="privacy" />

export default Page
