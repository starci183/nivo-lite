import { getLeadFlow } from "@/lib/flow-queries";
import type { LeadFlow } from "@/lib/flow-types";
import { FlowView } from "./component";

type FlowPanelProps = { readonly leadId: string };

const loadFlow = async (leadId: string): Promise<LeadFlow | null> => {
  try {
    return await getLeadFlow(leadId);
  } catch {
    return null;
  }
};

/** Lead page "Work flow" panel: loads this lead's flow on the server and hands plain data to the view. */
export const FlowPanel = async (props: FlowPanelProps) => <FlowView flow={await loadFlow(props.leadId)} />;
