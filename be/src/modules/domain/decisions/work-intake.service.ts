import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkItemsService, toProposal } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import type { IntakeResult } from "./work-engine.contracts"
import { proposalWithOptions } from "./work-options.policy"

@Injectable()
/**
 * Writes the queued work item of a spec, idempotently: the dedupe key is unique per workspace, so a second insert answers the
 * existing item and logs `core.duplicate_blocked`. It never processes anything, so the command chain can use it without
 * depending on the engine.
 */
export class WorkIntakeService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly items: WorkItemsService,
        private readonly modules: ModuleCatalogService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Inserts the item; `onInserted` runs once, only when this call really inserted the row. */
    async insert(ctx: WorkContext, spec: WorkSpec, manager?: EntityManager): Promise<IntakeResult> {
        const entry = await this.modules.actionOf(spec.action)
        if (entry === null) {
            throw new DecisionsError({ code: DecisionsErrorCode.UnknownAction, params: { action: spec.action } })
        }
        const item = await this.items.insert(
            {
                workspaceId: ctx.workspaceId,
                chainId: spec.chainId ?? null,
                depth: spec.depth ?? 0,
                department: entry.moduleKey,
                action: spec.action,
                subjectType: spec.subject_type,
                subjectId: spec.subject_id ?? null,
                leadId: spec.lead_id ?? null,
                inboundEventId: spec.inbound_event_id ?? null,
                parentId: spec.parent_id ?? null,
                dedupeKey: spec.dedupeKey,
                proposal: toProposal(proposalWithOptions(spec.seed ?? {}, spec)),
                installationId: spec.installationId ?? null,
            },
            manager,
        )
        if (item === null) return { item: await this.existing(ctx, spec, manager), created: false }
        if (spec.onInserted !== undefined) await spec.onInserted(item)
        return { item, created: true }
    }

    private async existing(ctx: WorkContext, spec: WorkSpec, manager?: EntityManager): Promise<WorkItem> {
        const item = await this.items.findByDedupe(ctx.workspaceId, spec.dedupeKey, manager)
        if (item === null) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        await this.evidence.log(
            ctx,
            {
                lead_id: item.lead_id,
                work_item_id: item.id,
                kind: "core.duplicate_blocked",
                actor: "NIVO",
                summary: this.catalog.get("engine.duplicate", {}, ctx.locale),
                evidence: spec.dedupeKey,
            },
            manager,
        )
        return item
    }
}
