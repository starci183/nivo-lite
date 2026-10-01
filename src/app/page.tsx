import type { Metadata } from "next";
import { Landing } from "@/features/landing";

export const metadata: Metadata = {
  title: "NIVO OS",
  description: "Human Leads. AI Operates. System Learns. One owner, one next step and evidence for every customer.",
};

/** Public landing page (default route). */
const HomePage = () => <Landing />;

export default HomePage;
