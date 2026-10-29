import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { HiringSettings } from "./hiring.contracts"
import type { EnsureSettingsOutput, SaveSettingsParams } from "./hiring-operations.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringTextService } from "./hiring-text.service"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { RESERVED_SLUGS, clip, slugify } from "./policies/text.policy"

const SLUG_TRIES = 20
const SLUG_MIN = 3
const BASE_MAX = 40
const SLUG_MAX = 60
const RETENTION_MIN = 7
const RETENTION_MAX = 730
const CONSENT_MIN = 20
const CONSENT_MAX = 800
const TONE_MAX = 200
const FALLBACK_BASE = "doanh-nghiep"

const outputOf = (settings: HiringSettings): EnsureSettingsOutput => ({
    publicSlug: settings.publicSlug,
    retentionDays: settings.retentionDays,
    notifyNewCandidate: settings.notifyNewCandidate,
    remindInterview: settings.remindInterview,
    autoCloseWhenFilled: settings.autoCloseWhenFilled,
    applyConsentText: settings.applyConsentText,
    adTone: settings.adTone,
})

@Injectable()
/** The hiring settings of a workspace: the public link, how long rejected candidates are kept, the reminders and the words an applicant agrees to. */
export class HiringSettingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly office: OfficeLog,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
    ) {}

    /** The settings of a workspace, created with a public slug made from its name on first use. */
    async ensure(workspaceId: string): Promise<HiringSettings> {
        const have = await this.data.settings(workspaceId)
        if (have !== undefined) return have
        const name = await this.office.workspaceName(workspaceId)
        const slugged = slugify(name, BASE_MAX) || FALLBACK_BASE
        const padded = slugged.length < SLUG_MIN ? `${slugged}-vn` : slugged
        const base = RESERVED_SLUGS.includes(padded) ? `${padded}-hr` : padded
        return this.create(workspaceId, base, 0)
    }

    private async create(workspaceId: string, base: string, attempt: number): Promise<HiringSettings> {
        if (attempt >= SLUG_TRIES) throw new HiringError({ code: HiringErrorCode.SettingsSlugUnavailable })
        const [row] = await callDbFunction<{ hiring_settings_init: string | null }>(
            this.entityManager,
            "public.hiring_settings_init",
            [workspaceId, attempt === 0 ? base : `${base}-${attempt + 1}`],
        )
        const made =
            row?.hiring_settings_init === "created" || row?.hiring_settings_init === "exists"
                ? await this.data.settings(workspaceId)
                : undefined
        return made ?? this.create(workspaceId, base, attempt + 1)
    }

    /** The settings for the workbench. */
    async read(userId: string, workspaceId: string): Promise<EnsureSettingsOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        return outputOf(await this.ensure(workspaceId))
    }

    /** Changes the settings named in the request. */
    async save(userId: string, workspaceId: string, request: SaveSettingsParams): Promise<EnsureSettingsOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.ensure(workspaceId)
        const patch = this.patchOf(request)
        const [row] = await callDbFunction<{ hiring_settings_save: string | null }>(
            this.entityManager,
            "public.hiring_settings_save",
            [workspaceId, JSON.stringify(patch)],
        )
        if (row?.hiring_settings_save === "taken") throw new HiringError({ code: HiringErrorCode.SlugTaken })
        return outputOf(await this.ensure(workspaceId))
    }

    private patchOf(request: SaveSettingsParams): Record<string, string | number | boolean> {
        const patch: Record<string, string | number | boolean> = {}
        if (request.publicSlug !== undefined) {
            const slug = slugify(request.publicSlug, SLUG_MAX)
            if (slug.length < SLUG_MIN) throw new HiringError({ code: HiringErrorCode.SlugInvalid })
            if (RESERVED_SLUGS.includes(slug)) throw new HiringError({ code: HiringErrorCode.SlugReserved })
            patch.publicSlug = slug
        }
        if (request.retentionDays !== undefined) {
            const days = request.retentionDays
            if (!Number.isInteger(days) || days < RETENTION_MIN || days > RETENTION_MAX) {
                throw new HiringError({ code: HiringErrorCode.RetentionInvalid })
            }
            patch.retentionDays = days
        }
        if (request.notifyNewCandidate !== undefined) patch.notifyNewCandidate = request.notifyNewCandidate
        if (request.remindInterview !== undefined) patch.remindInterview = request.remindInterview
        if (request.autoCloseWhenFilled !== undefined) patch.autoCloseWhenFilled = request.autoCloseWhenFilled
        if (request.applyConsentText !== undefined) {
            const text = request.applyConsentText.trim()
            if (text.length < CONSENT_MIN || text.length > CONSENT_MAX) {
                throw new HiringError({ code: HiringErrorCode.ConsentTextInvalid })
            }
            patch.applyConsentText = text
        }
        if (request.adTone !== undefined)
            patch.adTone = clip(request.adTone, TONE_MAX) || this.words.text("hiring.defaultTone")
        return patch
    }
}
