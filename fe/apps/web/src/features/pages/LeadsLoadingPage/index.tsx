import type { ReactElement } from "react"
import { LeadPanes } from "@/components/blocks/LeadPanes"

/** The same panes while the route loads: the block draws its own skeletons. */
export const LeadsLoadingPage = (): ReactElement => <LeadPanes leadId={null} query="" isFormOpen={false} />
