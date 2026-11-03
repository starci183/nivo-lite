import { LegalPage, legalMetadata } from "@/features/pages/LegalPage"

import type { ReactElement } from "react"
import type { Metadata } from "next"

/** The document title of the terms of service. */
export const generateMetadata = (): Promise<Metadata> => legalMetadata("terms")

/** Public terms of service (listed in src/proxy.ts PUBLIC_PATHS). */
const Page = (): ReactElement => <LegalPage doc="terms" />

export default Page
