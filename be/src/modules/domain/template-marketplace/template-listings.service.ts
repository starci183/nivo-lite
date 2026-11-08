import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { AgentPluginsService } from "@modules/domain/agent-plugins"
import { AgentTemplateVersionsService, insertedId } from "@modules/domain/agent-templates"
import type { AgentTemplatePackage } from "@nivo-lite/agent-sdk/template"
import { graphVocabulary } from "@modules/domain/intent-contracts"
import { ModulesService } from "@modules/domain/modules"
import { AdminAccessService } from "@modules/domain/platform-admin"
import type { Principal } from "@modules/platform/cqrs"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import {
    REVENUE_SHARE_DEFAULT,
    type ListingCard,
    type ListingCheck,
    type ListingView,
} from "./template-marketplace.contracts"
import { TemplateLikenessService } from "./template-likeness.service"
import { TemplateListingEntity } from "./persistence/entities"
import { runListingChecks, type ListingChecksContext } from "./policies/listing-checks.policy"
import { nextStatus } from "./policies/listing-review.policy"

/** The data kinds every kind of agent may be proposed rights over: what its seed grants. */
const KINDS_OF_PROVIDER: Readonly<Record<string, string>> = {
    brain: "brain",
    dossier: "customers",
    drive: "documents",
    sepay: "payments",
    zalo: "channels",
    telegram: "channels",
    einvoice: "invoices",
}

/** The most listings one page of the review or the catalogue shows. */
const LIST_MAX = 100

/** What the creator gives to offer a version. */
export interface SubmitListingRequest {
    /** The template key. */
    readonly key: string
    /** The version to offer. */
    readonly version: number
    /** The price in VND; zero is free. */
    readonly priceVnd: number
}

/** What the reviewer decides. */
export interface ReviewRequest {
    /** The listing. */
    readonly listingId: string
    /** Approve or reject. */
    readonly decision: "approve" | "reject"
    /** What the reviewer wrote. */
    readonly note: string
    /** The percent that is the creator, or null to keep the default. */
    readonly revenueSharePct: number | null
}

/** One approved listing with the card a buyer reads. */
export interface ApprovedListing {
    /** The stored listing. */
    readonly row: TemplateListingEntity
    /** The card of the listing. */
    readonly card: ListingCard
}

@Injectable()
/**
 * The listings of the marketplace. A creator offers one saved version at a price; the automated checks run on it; a platform reviewer
 * approves or rejects it. Only approved listings reach the catalogue. The state machine is the policy `nextStatus`, and a persona of
 * a real person is checked against the consent records at submit and again at approval.
 */
export class TemplateListingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly versions: AgentTemplateVersionsService,
        private readonly likeness: TemplateLikenessService,
        private readonly modules: ModulesService,
        private readonly plugins: AgentPluginsService,
        private readonly access: AdminAccessService,
    ) {}

    /** Offers a version of a template of the caller: runs the checks and, when they all pass, submits it for review. */
    async submit(userId: string, request: SubmitListingRequest): Promise<ListingView> {
        if (!Number.isInteger(request.priceVnd) || request.priceVnd < 0) {
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.PriceInvalid })
        }
        const stored = await this.versions.require(request.key, request.version)
        if (stored.creatorAccountId !== userId)
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NotYours })
        const checks = await this.checksOf(stored.package)
        const row = await this.entityManager.findOne(TemplateListingEntity, {
            where: { templateKey: request.key, version: request.version },
        })
        const current = row?.status ?? "draft"
        const status = nextStatus(
            current,
            "submit",
            checks.every((entry) => entry.ok),
        )
        if (status === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.BadTransition })
        const values = {
            status,
            priceVnd: request.priceVnd,
            checks: [...checks],
            reviewNote: "",
            firstParty: stored.firstParty,
            submittedBy: userId,
        }
        if (row === null) {
            const inserted = await this.entityManager.insert(TemplateListingEntity, {
                ...values,
                templateKey: request.key,
                version: request.version,
                revenueSharePct: REVENUE_SHARE_DEFAULT,
            })
            return this.viewById(insertedId(inserted.identifiers))
        }
        await this.entityManager.update(TemplateListingEntity, { id: row.id }, values)
        return this.viewById(row.id)
    }

    /** A platform reviewer approves or rejects a submitted listing; an approval runs the checks again and never passes with one failing. */
    async review(principal: Principal, request: ReviewRequest): Promise<ListingView> {
        const admin = this.access.requireAdmin(principal)
        const row = await this.requireRow(request.listingId)
        const stored = await this.versions.require(row.templateKey, row.version)
        const checks = request.decision === "approve" ? await this.checksOf(stored.package) : row.checks
        const pass = checks.every((entry) => entry.ok)
        const status = nextStatus(row.status, request.decision, pass)
        if (status === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.BadTransition })
        if (request.decision === "approve" && !pass) {
            const consent = checks.find((entry) => entry.id === "likeness_consent")
            throw new TemplateMarketplaceError({
                code:
                    consent?.ok === false
                        ? TemplateMarketplaceErrorCode.ConsentMissing
                        : TemplateMarketplaceErrorCode.ChecksFailed,
            })
        }
        await this.entityManager.update(
            TemplateListingEntity,
            { id: row.id },
            {
                status,
                checks: [...checks],
                reviewNote: request.note,
                reviewedBy: admin.userId,
                reviewedAt: this.clock.now(),
                revenueSharePct: request.revenueSharePct ?? row.revenueSharePct,
            },
        )
        return this.viewById(row.id)
    }

    /** The listings waiting for a reviewer, oldest first. */
    async queue(principal: Principal): Promise<ReadonlyArray<ListingView>> {
        this.access.requireAdmin(principal)
        const rows = await this.entityManager.find(TemplateListingEntity, {
            where: { status: "submitted" },
            order: { updatedAt: "ASC" },
            take: LIST_MAX,
        })
        return this.viewsOf(rows)
    }

    /** The listings of the templates of the caller. */
    async mine(userId: string): Promise<ReadonlyArray<ListingView>> {
        const templates = await this.versions.listOf(userId)
        if (templates.length === 0) return []
        const rows = await this.entityManager.find(TemplateListingEntity, {
            where: { templateKey: In(templates.map((template) => template.key)) },
            order: { updatedAt: "DESC" },
            take: LIST_MAX,
        })
        return this.viewsOf(rows)
    }

    /** The approved listings, as cards for the catalogue next to the built-in modules. */
    async catalogue(): Promise<ReadonlyArray<ListingCard>> {
        const rows = await this.entityManager.find(TemplateListingEntity, {
            where: { status: "approved" },
            order: { updatedAt: "DESC" },
            take: LIST_MAX,
        })
        const cards = await Promise.all(rows.map((row) => this.cardOf(row)))
        return cards.flatMap((card) => (card === null ? [] : [card]))
    }

    /** One approved listing for a buyer, or the refusal. */
    async approved(listingId: string): Promise<ApprovedListing> {
        const row = await this.entityManager.findOne(TemplateListingEntity, { where: { id: listingId } })
        if (row?.status !== "approved")
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NotAvailable })
        const card = await this.cardOf(row)
        if (card === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NotAvailable })
        return { row, card }
    }

    /** The newest approved version of a template, or zero when none is approved. */
    async latestApproved(key: string): Promise<number> {
        const row = await this.entityManager.findOne(TemplateListingEntity, {
            where: { templateKey: key, status: "approved" },
            order: { version: "DESC" },
        })
        return row?.version ?? 0
    }

    private async checksOf(pkg: AgentTemplatePackage): Promise<ReadonlyArray<ListingCheck>> {
        const module = await this.modules.find(pkg.baseModule)
        const allowed = new Set(
            ["brain", ...module.connectionProviders].flatMap((provider) => {
                const kind = KINDS_OF_PROVIDER[provider]
                return kind === undefined ? [] : [kind]
            }),
        )
        const context: ListingChecksContext = {
            pluginKeys: new Set(this.plugins.keys()),
            allowedRightKinds: allowed,
            knownTool: (tool) => graphVocabulary.hasProvider(tool.split(".", 1).join("")),
            askOnlyActions: new Set(
                module.authorityActions.filter((action) => action.maxMode === "ask").map((action) => action.action),
            ),
            consented: await this.likeness.covers(pkg.key, pkg.persona.likeness),
        }
        return runListingChecks(pkg, context)
    }

    private async requireRow(listingId: string): Promise<TemplateListingEntity> {
        const row = await this.entityManager.findOne(TemplateListingEntity, { where: { id: listingId } })
        if (row === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.ListingNotFound })
        return row
    }

    private async viewById(listingId: string): Promise<ListingView> {
        return this.viewOf(await this.requireRow(listingId))
    }

    private viewsOf(rows: ReadonlyArray<TemplateListingEntity>): Promise<ReadonlyArray<ListingView>> {
        return Promise.all(rows.map((row) => this.viewOf(row)))
    }

    private async viewOf(row: TemplateListingEntity): Promise<ListingView> {
        const stored = await this.versions.find(row.templateKey, row.version)
        return {
            id: row.id,
            templateKey: row.templateKey,
            version: row.version,
            status: row.status,
            priceVnd: row.priceVnd,
            revenueSharePct: row.revenueSharePct,
            checks: row.checks,
            reviewNote: row.reviewNote,
            firstParty: row.firstParty,
            name: stored?.package.listing.name ?? { vi: row.templateKey, en: row.templateKey },
            updatedAt: row.updatedAt.toISOString(),
        }
    }

    private async cardOf(row: TemplateListingEntity): Promise<ListingCard | null> {
        const stored = await this.versions.find(row.templateKey, row.version)
        if (stored === null) return null
        const pkg = stored.package
        return {
            id: row.id,
            templateKey: row.templateKey,
            version: row.version,
            name: pkg.listing.name,
            summary: pkg.listing.summary,
            points: pkg.listing.points,
            category: pkg.listing.category,
            publisherName: pkg.publisher.displayName,
            firstParty: row.firstParty,
            priceVnd: row.priceVnd,
            parameters: pkg.parameters,
            requiredProviders: pkg.requiredProviders,
            requiredAuthorityActions: pkg.requiredAuthorityActions,
            personName: pkg.persona.likeness?.personName ?? null,
        }
    }
}
