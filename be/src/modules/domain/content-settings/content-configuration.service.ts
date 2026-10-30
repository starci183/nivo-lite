import { ContentPillarsService } from "@modules/domain/content-pillars"
import type { ContentPillarDraft } from "@modules/domain/content-pillars"
import { ContentCadenceService } from "@modules/domain/content-cadence"
import type { ContentCadenceDraft } from "@modules/domain/content-cadence"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ContentAutomationKey,
    ContentBrandInput,
    ContentBrandSettings,
    ContentConfiguration,
    SavedContentRows,
} from "./content-configuration.contracts"
import { toContentBrandSettings } from "./content-configuration.mapper"
import { CONTENT_CADENCE_PRESETS, contentPillarPresets } from "./content-configuration.templates"
import { ContentSettingsError, ContentSettingsErrorCode } from "./errors/content-settings.error"
import { ContentSettingsEntity } from "./persistence/entities"

@Injectable()
/** The workspace's content themes, posting rhythm and brand settings; writes require an owner or manager. */
export class ContentConfigurationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly pillars: ContentPillarsService,
        private readonly cadence: ContentCadenceService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Reads the settings tab after proving active workspace membership. */
    async readConfiguration(userId: string, workspaceId: string): Promise<ContentConfiguration> {
        await this.members.require(userId, workspaceId)
        return this.readAuthorizedConfiguration(workspaceId)
    }

    /** Reads settings for an already authorized background job. */
    async readAuthorizedConfiguration(workspaceId: string): Promise<ContentConfiguration> {
        const [pillars, cadence, brand] = await Promise.all([
            this.pillars.list(workspaceId),
            this.cadence.list(workspaceId),
            this.entityManager.findOne(ContentSettingsEntity, { where: { workspaceId } }),
        ])
        return {
            pillars,
            cadence,
            settings: toContentBrandSettings(workspaceId, brand ?? undefined),
        }
    }

    /** Replaces the themes, preserving retained theme ids and removing omitted themes. */
    async savePillars(
        userId: string,
        workspaceId: string,
        rows: ReadonlyArray<ContentPillarDraft>,
    ): Promise<SavedContentRows> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        const names = rows.map((row) => row.name.trim().toLowerCase())
        const ids = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]))
        this.requireUnique(names)
        this.requireUnique(ids)
        return this.entityManager.transaction(async (transaction) => {
            await this.lockConfiguration(transaction, workspaceId)
            const current = await this.pillars.list(workspaceId, transaction)
            if (ids.some((id) => !current.some((row) => row.id === id))) {
                throw new ContentSettingsError({
                    code: ContentSettingsErrorCode.PillarNotFound,
                })
            }
            await this.pillars.replace(transaction, workspaceId, rows)
            return { count: rows.length }
        })
    }

    /** Adds the suggested themes only when the workspace has no themes. */
    async applyPillarPresets(userId: string, workspaceId: string): Promise<SavedContentRows> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        return this.entityManager.transaction(async (transaction) => {
            await this.lockConfiguration(transaction, workspaceId)
            const current = await this.pillars.list(workspaceId, transaction)
            if (current.length > 0) return { count: current.length }
            const presets = contentPillarPresets(this.catalog)
            await this.pillars.replace(transaction, workspaceId, presets)
            return { count: presets.length }
        })
    }

    /** Replaces the posting rhythm and removes omitted channels. */
    async saveCadence(
        userId: string,
        workspaceId: string,
        rows: ReadonlyArray<ContentCadenceDraft>,
    ): Promise<SavedContentRows> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        this.requireUnique(rows.map((row) => row.channel))
        return this.entityManager.transaction(async (transaction) => {
            await this.lockConfiguration(transaction, workspaceId)
            await this.cadence.replace(transaction, workspaceId, rows)
            return { count: rows.length }
        })
    }

    /** Replaces the rhythms with the suggested Facebook and Zalo cadence. */
    applyCadencePresets(userId: string, workspaceId: string): Promise<SavedContentRows> {
        return this.saveCadence(userId, workspaceId, CONTENT_CADENCE_PRESETS)
    }

    /** Saves the brand voice and normalizes at most fifteen brand hashtags. */
    async saveBrand(userId: string, workspaceId: string, brand: ContentBrandInput): Promise<ContentBrandSettings> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        const hashtags = [
            ...new Set(
                brand.hashtags
                    .split(/[\s,]+/)
                    .filter(Boolean)
                    .slice(0, 15)
                    .map((tag) => tag.replace(/^#+/, "").replace(/[\s#]+/g, ""))
                    .filter((tag) => tag !== "")
                    .map((tag) => `#${tag}`),
            ),
        ]
        await this.entityManager
            .createQueryBuilder(ContentSettingsEntity, "cs")
            .insert()
            .values({
                workspaceId,
                brandVoice: brand.brandVoice.trim(),
                avoid: brand.avoid.trim(),
                cta: brand.cta.trim(),
                hashtags,
            })
            .orUpdate(["brand_voice", "avoid", "cta", "hashtags"], ["workspace_id"])
            .execute()
        return this.readBrand(workspaceId)
    }

    /** Switches one automation atomically while retaining every other switch and dedupe mark. */
    async setAutomation(
        userId: string,
        workspaceId: string,
        key: ContentAutomationKey,
        on: boolean,
    ): Promise<ContentBrandSettings> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        await this.entityManager
            .createQueryBuilder(ContentSettingsEntity, "cs")
            .insert()
            .values({ workspaceId })
            .orIgnore()
            .execute()
        await this.entityManager
            .createQueryBuilder(ContentSettingsEntity, "cs")
            .update()
            .set({ automations: () => `jsonb_set("automations", ARRAY[:automationKey]::text[], :automationOn::jsonb)` })
            .setParameter("automationKey", key)
            .setParameter("automationOn", JSON.stringify(on))
            .where("workspace_id = :workspaceId", { workspaceId })
            .execute()
        return this.readBrand(workspaceId)
    }

    private async readBrand(workspaceId: string): Promise<ContentBrandSettings> {
        const row = await this.entityManager.findOne(ContentSettingsEntity, { where: { workspaceId } })
        return toContentBrandSettings(workspaceId, row ?? undefined)
    }

    private async lockConfiguration(transaction: EntityManager, workspaceId: string): Promise<void> {
        await transaction
            .createQueryBuilder(ContentSettingsEntity, "cs")
            .insert()
            .values({ workspaceId })
            .orIgnore()
            .execute()
        await transaction
            .createQueryBuilder(ContentSettingsEntity, "settings")
            .select("settings.workspaceId")
            .where("settings.workspaceId = :workspaceId", { workspaceId })
            .limit(1)
            .setLock("pessimistic_write")
            .getOne()
    }

    private requireUnique(values: ReadonlyArray<string>): void {
        if (new Set(values).size !== values.length)
            throw new ContentSettingsError({
                code: ContentSettingsErrorCode.Duplicate,
            })
    }
}
