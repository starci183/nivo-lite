import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { termsDoc } from "@/features/legal/terms";

export const metadata: Metadata = { title: "Điều khoản sử dụng - NIVO OS" };

/** Public terms of service (listed in src/proxy.ts PUBLIC_PATHS). */
const TermsPage = () => <LegalPage build={termsDoc} />;

export default TermsPage;
