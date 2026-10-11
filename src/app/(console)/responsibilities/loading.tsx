import { ResponsibilitiesView } from "@/features/responsibilities/view";

/** STATE-8: the responsibility board itself, with no data yet - the same heading, tabs and filters, the list as three skeleton rows. */
const ResponsibilitiesLoading = () => <ResponsibilitiesView isLoading rows={[]} initial={{ status: "all", due: "any" }} verifiedLabel="" />;

export default ResponsibilitiesLoading;
