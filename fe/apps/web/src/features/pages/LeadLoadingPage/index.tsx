import type { ReactElement } from "react"
import { LeadPanes } from "@/components/blocks/LeadPanes"

/** The same panes while the route loads, the lead not yet known: every region draws its own skeleton. */
export const LeadLoadingPage = (): ReactElement => <LeadPanes leadId="" query="" isFormOpen={false} />
