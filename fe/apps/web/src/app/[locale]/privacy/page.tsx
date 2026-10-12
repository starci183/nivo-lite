import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { privacyDoc } from "@/features/legal/privacy";

export const metadata: Metadata = { title: "Chính sách quyền riêng tư - NIVO OS" };

/** Public privacy policy (listed in src/proxy.ts PUBLIC_PATHS). */
const PrivacyPage = () => <LegalPage build={privacyDoc} />;

export default PrivacyPage;
