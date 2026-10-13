import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectTemplateFiles } from "@modules/integrations/template-files"
import type { TemplateFiles } from "@modules/integrations/template-files"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { TemplateDefinition } from "./automation-templates.contracts"
import { AutomationTemplatesLogEvent } from "./automation-templates.log-events"
import { AutomationTemplatesError, AutomationTemplatesErrorCode } from "./errors/automation-templates.error"
import type { AutomationTemplatesRow } from "./persistence/automation-templates.rows"
import { SELECT_TEMPLATES, UPSERT_TEMPLATE } from "./persistence/automation-templates.sql"
import { parseTemplateDefinition } from "./policies/template-definition.policy"

/** How long a read of the catalogue is reused; the templates change with a deploy, not per request. */
const CACHE_MS = 60_000

interface CachedCatalog {
    readonly at: number
    readonly templates: ReadonlyArray<TemplateDefinition>
}

@Injectable()
/** The catalogue of ready-made automations, kept in public.automation_templates and synced from the definition files by the cli. */
export class AutomationTemplatesService {
    private cached: CachedCatalog | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectTemplateFiles() private readonly files: TemplateFiles,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Every template in gallery order. */
    async listTemplates(): Promise<ReadonlyArray<TemplateDefinition>> {
        const now = this.clock.now().getTime()
        if (this.cached !== undefined && now - this.cached.at < CACHE_MS) return this.cached.templates
        const rows = await this.entityManager.query<Array<AutomationTemplatesRow>>(SELECT_TEMPLATES)
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
                await tx.query(UPSERT_TEMPLATE, [
                    template.key,
                    template.version,
                    template.moduleKey,
                    template.pack,
                    template.executor,
                    template.position,
                    JSON.stringify(template),
                ])
            })
        })
        this.cached = undefined
        return templates.map((template) => template.key)
    }

    /** Reads the definition files of the resources folder, writes the catalogue and logs the keys. */
    async syncFromFiles(): Promise<ReadonlyArray<string>> {
        const keys = await this.syncCatalog(await this.files.readDefinitions())
        this.logger.info(AutomationTemplatesLogEvent.CatalogSynced, { count: keys.length, keys })
        return keys
    }
}
