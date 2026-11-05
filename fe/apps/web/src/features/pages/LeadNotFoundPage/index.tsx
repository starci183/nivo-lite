import type { ReactElement } from "react"
import { LeadPanes } from "@/components/blocks/LeadPanes"

/** Shown when the lead id does not exist: the list stays, the main pane says so and offers the way back. */
export const LeadNotFoundPage = (): ReactElement => <LeadPanes leadId={null} isMissing query="" isFormOpen={false} />
