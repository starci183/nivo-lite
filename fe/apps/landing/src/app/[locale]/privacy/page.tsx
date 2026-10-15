import { LegalPage, legalMetadata } from "@/features/pages/LegalPage"

/** The document title of the privacy policy. */
export const generateMetadata = () => legalMetadata("privacy")

/** Public privacy policy (listed in src/proxy.ts PUBLIC_PATHS). */
const Page = () => <LegalPage doc="privacy" />

export default Page
