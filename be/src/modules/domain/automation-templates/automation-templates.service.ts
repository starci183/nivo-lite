import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { TemplateDefinition } from "./automation-templates.contracts"
import { TEMPLATE_CATALOG } from "./automation-templates.templates"
import { AutomationTemplatesLogEvent } from "./automation-templates.log-events"
import { AutomationTemplatesError, AutomationTemplatesErrorCode } from "./errors/automation-templates.error"
import { AutomationTemplateEntity } from "./persistence/entities"
import { parseTemplateDefinition } from "./policies/template-definition.policy"

/** How long a read of the catalogue is reused; the templates change with a deploy, not per request. */
const CACHE_MS = 60_000

interface CachedCatalog {
    readonly at: number
    readonly templates: ReadonlyArray<TemplateDefinition>
}

@Injectable()
/** The catalogue of ready-made automations, kept in public.automation_templates and synced from the TypeScript catalogue by the cli. */
export class AutomationTemplatesService {
    private cached: CachedCatalog | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Every template in gallery order. */
    async listTemplates(): Promise<ReadonlyArray<TemplateDefinition>> {
        const now = this.clock.now().getTime()
        if (this.cached !== undefined && now - this.cached.at < CACHE_MS) return this.cached.templates
        const rows = await this.entityManager.find(AutomationTemplateEntity, {
            order: { position: "ASC", key: "ASC" },
            take: 500,
        })
        const templates = rows.map((row) => parseTemplateDefinition(row.definition))
        this.cached = { at: now, templates }
        return templates
    }

    /** The template of a key; an unknown key is refused. */
    async templateOf(key: string): Promise<TemplateDefinition> {
        const template = (await this.listTemplates()).find((candidate) => candidate.key === key)
        if (template === undefined)
            throw new AutomationTemplatesError({ code: AutomationTemplatesErrorCode.TemplateUnknown })
        return template
    }

    /** Validates every definition first, then writes them all in one transaction; answers the keys written. */
    async syncCatalog(definitions: ReadonlyArray<unknown>): Promise<ReadonlyArray<string>> {
        const templates = definitions.map((definition) => parseTemplateDefinition(definition))
        await this.entityManager.transaction(async (tx) => {
            await eachInOrder(templates, async (template) => {
                await tx.upsert(
                    AutomationTemplateEntity,
                    {
                        key: template.key,
                        version: template.version,
                        moduleKey: template.moduleKey,
                        pack: template.pack,
                        executor: template.executor,
                        position: template.position,
                        definition: template,
                        updatedAt: () => "now()",
                    },
                    ["key"],
                )
            })
        })
        this.cached = undefined
        return templates.map((template) => template.key)
    }

    /** Writes the TypeScript catalogue into the table and logs the keys. */
    async syncFromCatalog(): Promise<ReadonlyArray<string>> {
        const keys = await this.syncCatalog(TEMPLATE_CATALOG)
        this.logger.info(AutomationTemplatesLogEvent.CatalogSynced, { count: keys.length, keys })
        return keys
    }
}
