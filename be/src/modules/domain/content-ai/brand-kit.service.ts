import { Injectable } from "@nestjs/common"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { Evidence } from "@modules/domain/brain-facts"
import { ContentBrandProposalsService } from "@modules/domain/content-brand-proposals"
import type { BrandProposalRecord } from "@modules/domain/content-brand-proposals"
import { ContentSettingsService } from "@modules/domain/content-settings"
import type { StoredGuidelineBrand } from "@modules/domain/content-settings"
import { EventsService } from "@modules/domain/events"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectDocuments } from "@modules/integrations/documents"
import type { DocumentsPort } from "@modules/integrations/documents"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { brandKitMessages, brandVoiceOf, cleanBrandKit, readBrandKit } from "./brand-kit.policy"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"
import type {
    BrandDecision,
    GuidelineKit,
    BrandProposal,
    ProposeBrandRequest,
    WorkspaceBrand,
} from "./content-agent.contracts"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
/** The largest guideline file read. */
export const BRAND_FILE_MAX_BYTES = 20 * 1024 * 1024
const READ_TIMEOUT_MS = 90_000
const EMPTY_KIT: GuidelineKit = { brandName: "", colors: [], fonts: [], tone: "", address: "", imagery: [], avoid: [] }

const proposalOf = (record: BrandProposalRecord): BrandProposal => ({
    ...record,
    kit: cleanBrandKit({ ...EMPTY_KIT, ...(typeof record.payload === "object" ? record.payload : {}) }) ?? EMPTY_KIT,
})

/** The kit stored in the content settings, or null when none was confirmed. */
export const storedKitOf = (stored: StoredGuidelineBrand | null, brandName: string): GuidelineKit | null => {
    if (stored === null) return null
    return cleanBrandKit({
        brandName,
        colors: Array.isArray(stored.colors) ? stored.colors : [],
        fonts: stored.fonts,
        tone: stored.tone,
        address: "",
        imagery: stored.imagery,
        avoid: stored.avoid.split("\n").filter((line) => line.trim() !== ""),
    })
}

@Injectable()
/**
 * The brand kit of AI Marketing: a guideline PDF attached in the setup chat is read (unpdf through the documents integration) and
 * given to the model once; the kit it answers becomes a confirm card. Only the owner's confirmation writes it into the content
 * settings (`brand_*`, voice, avoid) and the video brand kit (main colors, name), through their owners.
 */
export class BrandKitService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectDocuments() private readonly documents: DocumentsPort,
        private readonly generations: DirectGenerationService,
        private readonly members: WorkspaceMembersService,
        private readonly setupMessages: SetupMessagesService,
        private readonly events: EventsService,
        private readonly proposalsStore: ContentBrandProposalsService,
        private readonly settings: ContentSettingsService,
        private readonly videoKits: VideoBrandKitsService,
        private readonly facts: BrainFactsService,
    ) {}

    /** Reads the attached guideline into a waiting brand proposal; in a setup chat the file and NIVO's answer join the chat. */
    async propose(principalId: string, request: ProposeBrandRequest): Promise<BrandProposal> {
        const member = await this.members.require(principalId, request.workspaceId, GOVERNORS)
        const file = {
            name: request.file.name,
            bytes: new Uint8Array(Buffer.from(request.file.contentBase64, "base64")),
        }
        const installationId = request.installationId === "" ? null : request.installationId
        const setupSessionId = request.setupSessionId === "" ? null : request.setupSessionId
        if (!/\.pdf$/iu.test(file.name) || file.bytes.length === 0 || file.bytes.length > BRAND_FILE_MAX_BYTES) {
            throw new ContentAiError({ code: ContentAiErrorCode.FileInvalid })
        }
        const text = await this.documents.readFile(file.name, file.bytes, "application/pdf").catch((cause: unknown) => {
            throw new ContentAiError({ code: ContentAiErrorCode.FileInvalid, cause })
        })
        const outcome = await this.generations.run({
            workspaceId: request.workspaceId,
            purpose: "brand_kit",
            responseFormat: "json",
            timeoutMs: READ_TIMEOUT_MS,
            kind: "engine",
            module: "content",
            locale: request.locale,
            messages: brandKitMessages(text, request.locale),
        })
        const kit = outcome.ok ? readBrandKit(outcome.output) : null
        if (kit === null) throw new ContentAiError({ code: ContentAiErrorCode.BrandUnreadable })
        const stored = await this.proposalsStore.insert({
            workspaceId: request.workspaceId,
            installationId,
            setupSessionId,
            fileName: file.name,
            fileSize: file.bytes.length,
            payload: JSON.stringify(kit),
        })
        if (stored === null) throw new ContentAiError({ code: ContentAiErrorCode.ProposalNotFound })
        if (setupSessionId !== null) {
            const base = { workspaceId: request.workspaceId, setupSessionId }
            await this.setupMessages.post({
                ...base,
                role: "user",
                author: member.displayName,
                body: `[PDF] ${file.name}`,
            })
            await this.setupMessages.post({
                ...base,
                role: "assistant",
                author: "NIVO",
                body: this.catalog.get("marketing.brandRead", { file: file.name }, request.locale),
            })
        }
        return proposalOf(stored)
    }

    /** The brand proposals of an agent instance, newest first. */
    async proposals(
        principalId: string,
        workspaceId: string,
        installationId: string,
    ): Promise<ReadonlyArray<BrandProposal>> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        return (await this.proposalsStore.list(workspaceId, installationId)).map(proposalOf)
    }

    /** Confirms (with the card's edits) or rejects a waiting proposal; a confirmation writes the kit where content and video read it. */
    async decide(
        principalId: string,
        workspaceId: string,
        proposalId: string,
        decision: BrandDecision,
    ): Promise<BrandProposal> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        const found = await this.proposalsStore.find(workspaceId, proposalId)
        if (found === null) throw new ContentAiError({ code: ContentAiErrorCode.ProposalNotFound })
        const proposal = proposalOf(found)
        const kit = decision.kit === undefined || decision.kit === null ? proposal.kit : cleanBrandKit(decision.kit)
        if (kit === null) throw new ContentAiError({ code: ContentAiErrorCode.KitInvalid })
        const status = decision.decision === "confirm" ? "applied" : "rejected"
        const closed = await this.proposalsStore.close(workspaceId, proposalId, {
            status,
            payload: JSON.stringify(kit),
            decidedBy: member.displayName,
        })
        if (closed === null) throw new ContentAiError({ code: ContentAiErrorCode.ProposalDecided })
        if (status === "applied") {
            await this.write(workspaceId, principalId, kit, proposal.fileName)
            await this.remember(workspaceId, member.displayName, kit, proposal)
            await this.events.record({
                workspaceId,
                kind: "content.brand_applied",
                actor: member.displayName,
                summary: `brand kit from ${proposal.fileName}`,
            })
        }
        return proposalOf(closed)
    }

    /** The confirmed kit of the workspace and its logo path (video brand kit), for drafting. */
    async brandOf(workspaceId: string): Promise<WorkspaceBrand> {
        const [stored, identity] = await Promise.all([
            this.settings.guidelineBrandOf(workspaceId),
            this.videoKits.identityOf(workspaceId),
        ])
        return { kit: storedKitOf(stored, identity.shopName), logoPath: identity.logoPath }
    }

    /** Keeps the confirmed kit in the Second Brain (workspace knowledge, layer 2) as owner facts citing the guideline. */
    private async remember(
        workspaceId: string,
        actor: string,
        kit: GuidelineKit,
        proposal: BrandProposal,
    ): Promise<void> {
        const evidence: Evidence = { kind: "document", ref: `brand_proposal:${proposal.id}`, label: proposal.fileName }
        const lines: ReadonlyArray<readonly [string, string]> = [
            ["Brand tone", brandVoiceOf(kit)],
            ["Brand colors", kit.colors.map((color) => `${color.name} ${color.hex}`).join(", ")],
            ["Brand fonts", kit.fonts.join(", ")],
            ["Brand imagery", kit.imagery.join("; ")],
            ["Brand avoid", kit.avoid.join("; ")],
        ]
        await eachInOrder(
            lines.filter(([, value]) => value !== ""),
            async ([attributeLabel, value]) => {
                await this.facts.propose(workspaceId, {
                    subjectType: "business",
                    subjectLabel: kit.brandName === "" ? "Brand" : kit.brandName,
                    attributeLabel,
                    value,
                    scope: "internal",
                    sourceKind: "owner",
                    proposedBy: actor,
                    evidence: [evidence],
                })
            },
        )
    }

    private async write(workspaceId: string, principalId: string, kit: GuidelineKit, fileName: string): Promise<void> {
        await this.settings.saveGuidelineBrand(workspaceId, {
            colors: kit.colors,
            fonts: kit.fonts,
            tone: kit.tone,
            imagery: kit.imagery,
            source: fileName,
            voice: brandVoiceOf(kit),
            avoid: kit.avoid.join("\n"),
        })
        const [primary, secondary] = kit.colors
        if (primary === undefined) return
        await this.videoKits.saveGuidelineColors(workspaceId, principalId, {
            primary: primary.hex,
            secondary: (secondary ?? primary).hex,
            shopName: kit.brandName,
        })
    }
}
