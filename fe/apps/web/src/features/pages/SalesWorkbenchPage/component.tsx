import type { ReactNode } from "react"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { SalesActivity } from "@/components/blocks/SalesActivity"
import { SalesAttention } from "@/components/blocks/SalesAttention"
import { SalesContracts } from "@/components/blocks/SalesContracts"
import { SalesDecisions } from "@/components/blocks/SalesDecisions"
import { SalesFigures } from "@/components/blocks/SalesFigures"
import { SalesHandoffs } from "@/components/blocks/SalesHandoffs"
import { SalesOrders } from "@/components/blocks/SalesOrders"
import { SalesPipeline } from "@/components/blocks/SalesPipeline"
import { ChatbotInbox } from "@/components/blocks/ChatbotInbox"
import { SalesWaiting } from "@/components/blocks/SalesWaiting"
import { SalesWorkbenchGate } from "@/components/blocks/SalesWorkbenchGate"

/** The six Sales areas, by tab id. */
type SalesTab = "attention" | "pipeline" | "decisions" | "handoff" | "contracts" | "activity" | "conversation"

/** The resolved route state and the tab names of the Sales workbench. */
interface SalesWorkbenchPageBaseProps {
    readonly props: {
        /** The Sales agent instance the workbench opens for. */
        readonly installationId: string | null
        /** The selected tab. */
        readonly tab: string
        /** The decision to highlight, if any. */
        readonly focus: string | null
        /** The conversation of a customer to draw beside the desk (`?conversation=`). */
        readonly conversation: string | null
        readonly tabs: Readonly<Record<SalesTab, string>>
    }
}

/** The six Sales areas in tab order, each a block that reads the workbench in the browser. */
const AREAS: ReadonlyArray<{ readonly id: SalesTab; readonly draw: (focus: string | null) => ReactNode }> = [
    { id: "attention", draw: () => <SalesAttention /> },
    { id: "pipeline", draw: () => <SalesPipeline /> },
    { id: "decisions", draw: (focus) => <SalesDecisions focusId={focus} /> },
    {
        id: "handoff",
        draw: () => (
            <>
                <SalesHandoffs />
                <SalesOrders />
            </>
        ),
    },
    { id: "contracts", draw: () => <SalesContracts /> },
    { id: "activity", draw: () => <SalesActivity /> },
]

/** The Sales workbench: the agent dashboard frame around the six Sales areas, each a block that reads the workbench in the browser. */
export const SalesWorkbenchPageBase = (props: SalesWorkbenchPageBaseProps) => {
    const p = props.props
    return (
        <AgentDashboardFrame
            module="sales"
            installationId={p.installationId}
            initialTab={p.tab}
            ribbon={<SalesFigures />}
            waitingTab="decisions"
            waiting={<SalesWaiting />}
            tabs={[
                ...AREAS.map((area) => ({
                    id: area.id,
                    label: p.tabs[area.id],
                    content: (
                        <SalesWorkbenchGate placeholder={p.tabs[area.id]}>{area.draw(p.focus)}</SalesWorkbenchGate>
                    ),
                })),
                ...(p.conversation === null
                    ? []
                    : [
                          {
                              id: "conversation",
                              label: p.tabs.conversation,
                              // The customer is one record with one conversation: the thread and side panel are the ones the Chatbot draws.
                              content: <ChatbotInbox installationId={null} focus={p.conversation} />,
                          },
                      ]),
            ]}
        />
    )
}
