import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type { AgentDirectoryService } from "@modules/domain/agents"
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
    readonly gaps: MockOf<KnowledgeGapNotesService>
    readonly modules: MockOf<Dependencies[15]>
    readonly conversations: MockOf<AgentConversationsService>
    readonly evidence: MockOf<EvidenceService>
    readonly items: MockOf<WorkItemsService>
    readonly bindings: MockOf<AgentBindingsService>
    readonly rules: MockOf<AuthorityRulesService>
    readonly hiring: MockOf<HiringPublicService>
    readonly staff: MockOf<Dependencies[13]>
    readonly directory: MockOf<AgentDirectoryService>
}

/** Arranges the exact kit-created ports supplied by the colocated owner spec. */
export const arrangeCustomerOutcomes = (doubles: CustomerOutcomeDoubles): void => {
    const { engine, bus, inbound, invoices, gaps, modules, items, bindings, rules, staff, directory } = doubles
    engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status: "waiting_decision", lead_id: null }))
    engine.runQueued.mockResolvedValue(0)
    engine.checkGraph.mockResolvedValue({ outcome: "run", unread: [], unjudged: null, divert: null })
    engine.runDiverted.mockResolvedValue(mock<WorkItem>({ id: "w8", status: "waiting_decision", lead_id: null }))
    bus.sendCommandItem.mockResolvedValue(mock<WorkItem>({ id: "w3", status: "done", lead_id: "l9", reason: null }))
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "e1" })
    inbound.mark.mockResolvedValue(undefined)
    invoices.latestOfLead.mockResolvedValue(null)
    gaps.note.mockResolvedValue(undefined)
    modules.settle.mockResolvedValue({ reply: null, lines: [] })
    items.findByDedupe.mockResolvedValue(null)
    bindings.agentsFor.mockResolvedValue([])
    staff.escalate.mockResolvedValue(true)
    rules.ruleFor.mockResolvedValue(null)
    directory.activeOf.mockResolvedValue([])
}
