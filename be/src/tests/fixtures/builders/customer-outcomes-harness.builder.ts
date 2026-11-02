import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type { AgentBindingsService } from "@modules/domain/agent-connections"
import type { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { KnowledgeGapNotesService } from "@modules/domain/agent-knowledge"
import type { CommandBusService, EvidenceService, WorkEngineService, WorkItem } from "@modules/domain/decisions"
import type { HiringPublicService } from "@modules/domain/hiring"
import type { InboundEventsService } from "@modules/domain/inbound-events"
import type { InvoicesService } from "@modules/domain/invoices"
import type { WorkItemsService } from "@modules/domain/work-items"
import type { CustomerOutcomesService } from "@modules/domain/customer-turns"

type Dependencies = ConstructorParameters<typeof CustomerOutcomesService>

interface CustomerOutcomeDoubles {
    readonly engine: MockOf<WorkEngineService>
    readonly bus: MockOf<CommandBusService>
    readonly inbound: MockOf<InboundEventsService>
    readonly invoices: MockOf<InvoicesService>
    readonly purchases: MockOf<Dependencies[13]>
    readonly gaps: MockOf<KnowledgeGapNotesService>
    readonly modules: MockOf<Dependencies[16]>
    readonly conversations: MockOf<AgentConversationsService>
    readonly evidence: MockOf<EvidenceService>
    readonly items: MockOf<WorkItemsService>
    readonly bindings: MockOf<AgentBindingsService>
    readonly rules: MockOf<AuthorityRulesService>
    readonly hiring: MockOf<HiringPublicService>
    readonly staff: MockOf<Dependencies[14]>
}

/** Arranges the exact kit-created ports supplied by the colocated owner spec. */
export const arrangeCustomerOutcomes = (doubles: CustomerOutcomeDoubles): void => {
    const { engine, bus, inbound, invoices, purchases, gaps, modules, items, bindings, rules, staff } = doubles
    engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status: "waiting_decision", lead_id: null }))
    engine.startOrderWork.mockResolvedValue(mock<WorkItem>({ id: "w2", status: "done", lead_id: "l9" }))
    engine.runQueued.mockResolvedValue(0)
    engine.checkGraph.mockResolvedValue({ outcome: "run", unread: [], unjudged: null, divert: null })
    engine.runDiverted.mockResolvedValue(mock<WorkItem>({ id: "w8", status: "waiting_decision", lead_id: null }))
    bus.sendCommandItem.mockResolvedValue(mock<WorkItem>({ id: "w3", status: "done", lead_id: "l9", reason: null }))
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "e1" })
    inbound.mark.mockResolvedValue(undefined)
    invoices.latestOfLead.mockResolvedValue(null)
    const settled = { lines: [], changed: false, leadId: null }
    purchases.recordOrder.mockResolvedValue(settled)
    purchases.recordClaim.mockResolvedValue(settled)
    gaps.note.mockResolvedValue(undefined)
    modules.settle.mockResolvedValue({ reply: null, lines: [] })
    items.findByDedupe.mockResolvedValue(null)
    bindings.agentsFor.mockResolvedValue([])
    staff.escalate.mockResolvedValue(true)
    rules.ruleFor.mockResolvedValue(null)
}
