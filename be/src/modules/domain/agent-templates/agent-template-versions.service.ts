import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { agentTemplatePackageSchema } from "./agent-template.schema"
import { AgentTemplatesError, AgentTemplatesErrorCode } from "./errors/agent-templates.error"
import type { AgentTemplatePackage, TemplateVersionView, TemplateView } from "./agent-templates.contracts"
import { insertedId } from "./policies/inserted-id.policy"
import { AgentTemplateEntity, AgentTemplateVersionEntity } from "./persistence/entities"

/** One version with the template it belongs to, the package read back and validated. */
export interface StoredVersion {
    /** The template key. */
    readonly key: string
    /** The version. */
    readonly version: number
    /** The package. */
    readonly package: AgentTemplatePackage
    /** The hash. */
    readonly hash: string
    /** The changelog. */
    readonly changelog: string
    /** True when the buyer must read it. */
    readonly breaking: boolean
    /** The account that owns the template. */
    readonly creatorAccountId: string
    /** True for a template of the platform itself. */
    readonly firstParty: boolean
}

/** What saving a new version takes. */
export interface NewVersion {
    /** The package. */
    readonly package: AgentTemplatePackage
    /** The account saving it. */
    readonly creatorAccountId: string
    /** The workspace it was packaged from. */
    readonly sourceWorkspaceId: string | null
    /** The changelog. */
    readonly changelog: string
    /** True when the buyer must read it. */
    readonly breaking: boolean
    /** True for a template of the platform itself. */
    readonly firstParty?: boolean | undefined
    /** The key of the template this one was forked from. */
    readonly forkedFrom?: string | undefined
}

/** The most templates one account lists. */
const LIST_MAX = 100

const versionViewOf = (row: AgentTemplateVersionEntity): TemplateVersionView => ({
    id: row.id,
    key: row.key,
    version: row.version,
    hash: row.hash,
    changelog: row.changelog,
    breaking: row.breaking,
    createdAt: row.createdAt.toISOString(),
})

@Injectable()
/**
 * The store of agent templates: one row per template and an immutable row per packaged version (the application role may only read
 * and insert versions, so the database refuses a change). Every package read back is validated, and one that does not parse is no version.
 */
export class AgentTemplateVersionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The template with this key, or null. */
    templateOf(key: string): Promise<AgentTemplateEntity | null> {
        return this.entityManager.findOne(AgentTemplateEntity, { where: { key } })
    }

    /** The newest version number of a template, zero when it has none. */
    async latestNumber(key: string): Promise<number> {
        const row = await this.entityManager.findOne(AgentTemplateVersionEntity, {
            where: { key },
            order: { version: "DESC" },
            select: { version: true },
        })
        return row?.version ?? 0
    }

    /** One version of a template, or null when it does not exist or does not parse. */
    async find(key: string, version: number): Promise<StoredVersion | null> {
        const template = await this.templateOf(key)
        const row = await this.entityManager.findOne(AgentTemplateVersionEntity, { where: { key, version } })
        if (template === null || row === null) return null
        const parsed = agentTemplatePackageSchema.safeParse(row.package)
        return parsed.success
            ? {
                  key,
                  version,
                  package: parsed.data,
                  hash: row.hash,
                  changelog: row.changelog,
                  breaking: row.breaking,
                  creatorAccountId: template.creatorAccountId,
                  firstParty: template.firstParty,
              }
            : null
    }

    /** One version, or the typed refusal. */
    async require(key: string, version: number): Promise<StoredVersion> {
        const found = await this.find(key, version)
        if (found === null) throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.VersionNotFound })
        return found
    }

    /** The templates of an account with their versions, newest first. */
    async listOf(creatorAccountId: string): Promise<ReadonlyArray<TemplateView>> {
        const templates = await this.entityManager.find(AgentTemplateEntity, {
            where: { creatorAccountId },
            order: { createdAt: "DESC" },
            take: LIST_MAX,
        })
        return Promise.all(
            templates.map(async (template) => {
                const rows = await this.entityManager.find(AgentTemplateVersionEntity, {
                    where: { templateId: template.id },
                    order: { version: "DESC" },
                    take: LIST_MAX,
                })
                return {
                    id: template.id,
                    key: template.key,
                    baseModule: template.baseModule,
                    name: template.name,
                    versions: rows.map((row) => versionViewOf(row)),
                }
            }),
        )
    }

    /**
     * Saves the next version of a template, creating the template on its first version. A key another account owns is refused, and so
     * is a version number that is not the next one.
     */
    save(input: NewVersion): Promise<TemplateVersionView> {
        return this.entityManager.transaction(async (tx) => {
            const pkg = input.package
            const existing = await tx.findOne(AgentTemplateEntity, { where: { key: pkg.key } })
            if (existing !== null && existing.creatorAccountId !== input.creatorAccountId) {
                throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.KeyTaken })
            }
            const templateId =
                existing?.id ??
                insertedId(
                    (
                        await tx.insert(AgentTemplateEntity, {
                            key: pkg.key,
                            creatorAccountId: input.creatorAccountId,
                            baseModule: pkg.baseModule,
                            name: pkg.listing.name,
                            sourceWorkspaceId: input.sourceWorkspaceId,
                            firstParty: input.firstParty === true,
                            forkedFrom: input.forkedFrom ?? null,
                        })
                    ).identifiers,
                )
            const inserted = await tx.insert(AgentTemplateVersionEntity, {
                templateId,
                key: pkg.key,
                version: pkg.version,
                package: pkg,
                hash: pkg.hash,
                changelog: input.changelog,
                breaking: input.breaking,
                createdBy: input.creatorAccountId,
            })
            return versionViewOf(
                await tx.findOneOrFail(AgentTemplateVersionEntity, { where: { id: insertedId(inserted.identifiers) } }),
            )
        })
    }
}
