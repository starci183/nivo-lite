import { LeadsList } from "@/features/leads-list";

/** STATE-8: the Leads page itself, with no data yet - the same heading, filters and tabs, the list as three skeleton rows. */
const LeadsLoading = () => <LeadsList isLoading leads={[]} nowIso="" />;

export default LeadsLoading;
