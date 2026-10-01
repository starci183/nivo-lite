import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "NIVO team console", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The team console. Access is checked by every page and action (requirePlatformAdmin), not here: layouts do not re-run on navigation. */
const AdminLayout = ({ children }: { readonly children: ReactNode }) => children;

export default AdminLayout;
