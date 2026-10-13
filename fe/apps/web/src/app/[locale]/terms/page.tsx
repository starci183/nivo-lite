import { LegalPage, legalMetadata } from "@/features/pages/LegalPage"

/** The document title of the terms of service. */
export const generateMetadata = () => legalMetadata("terms")

/** Public terms of service (listed in src/proxy.ts PUBLIC_PATHS). */
const Page = () => <LegalPage doc="terms" />

export default Page
