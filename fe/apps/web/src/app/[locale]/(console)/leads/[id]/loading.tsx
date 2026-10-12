import { LeadPageView } from "@/features/lead-detail/page/view";

/** STATE-8: the lead page itself, with no data yet - the same trail, panels and section titles, every value as a skeleton. */
const LeadLoading = () => <LeadPageView isLoading detail={null} />;

export default LeadLoading;
