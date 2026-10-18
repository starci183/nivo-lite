import { hiringLinkPrincipal, requireHiringLinkBinding } from "./policies/link-credential.policy"
import type { CredentialPrincipal } from "@modules/domain/identity"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalGate, OfficeLog, ModuleTextGenerator } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { JobRecord, OfferRecord, OfferTerms } from "./hiring.contracts"
import type { CancelOfferParams, RequestOfferOutput, RequestOfferParams } from "./hiring-operations.contracts"
import type {
    PublicOfferOutput,
    PublicOfferParams,
    RespondOfferOutput,
    RespondOfferParams,
} from "./hiring-public.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringNotifyService } from "./hiring-notify.service"
import { HiringTextService } from "./hiring-text.service"
import { ANSWER_OFFER, CANCEL_OFFER, CREATE_OFFER, LINK_OFFER, MARK_OFFER_SENT } from "./persistence/hiring.sql"
import type { FlagRow, CancelledOfferRow, IdRow, TextRow } from "./persistence/hiring.rows"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { findFairnessViolations } from "./policies/fairness.policy"
import { fieldText } from "./policies/gate-fields.policy"
import { parseLooseJson, textField } from "./policies/json.policy"
import { cleanLetterPart, composeOffer, payPhrase, termsBlock } from "./policies/offer-letter.policy"
import { termsJson } from "./policies/row-mappers.policy"
import { clip, isToken } from "./policies/text.policy"
import { addDays } from "./policies/vn-time.policy"

/** Days an offer stays valid after it is sent. */
const OFFER_DAYS = 7
const HIDDEN_STATUSES: ReadonlySet<string> = new Set(["draft", "waiting", "cancelled"])
/** The status an offer takes from what the gate answered. */
const STATUS_OF_DECISION: Readonly<Record<string, string>> = { waiting_decision: "waiting", done: "sent" }
const AI_TIMEOUT_MS = 75_000
const ONBOARDING_STEPS = 7
const TITLE_MAX = 140
const PAY_MAX = 200
const START_MAX = 60
const PROBATION_MAX = 100
const NOTE_MAX = 600

@Injectable()
/** Offers: the terms are typed by the owner, the letter is drafted and approved through the gate, the candidate answers on a link. */
export class HiringOffersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly gate: ApprovalGate,
        private readonly generator: ModuleTextGenerator,
        private readonly office: OfficeLog,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
        private readonly links: HiringLinksService,
        private readonly notify: HiringNotifyService,
        private readonly candidates: HiringCandidatesService,
    ) {}

    private async requireOffer(workspaceId: string, offerId: string): Promise<OfferRecord> {
        const offer = await this.data.offer(workspaceId, offerId)
        if (offer === undefined) throw new HiringError({ code: HiringErrorCode.OfferNotFound })
        return offer
    }

    private async requireJob(workspaceId: string, jobId: string): Promise<JobRecord> {
        const job = await this.data.job(workspaceId, jobId)
        if (job === undefined) throw new HiringError({ code: HiringErrorCode.JobNotFound })
        return job
    }

    private pay(job: JobRecord): string {
        return payPhrase(job, this.words.textOf, (amount) => this.words.amount(amount))
    }

    /** The letter: drafted by the model only for the greeting and the closing, with the terms written by code in between. */
    private async letter(
        workspaceId: string,
        candidateName: string,
        job: JobRecord,
        terms: OfferTerms,
    ): Promise<{ draft: string; usedModel: boolean }> {
        const shop = await this.office.workspaceName(workspaceId)
        const written = await this.generator.generate({
            workspaceId,
            purpose: "hiring_offer",
            module: "hiring",
            system: this.words.text("hiring.offer.system"),
            user: this.words.text("hiring.offer.user", {
                shop,
                name: candidateName,
                title: terms.title === "" ? job.title : terms.title,
            }),
            timeoutMs: AI_TIMEOUT_MS,
        })
        const parsed = written.ok ? parseLooseJson(written.output) : null
        const opening = cleanLetterPart(textField(parsed, "opening"))
        const closing = cleanLetterPart(textField(parsed, "closing"))
        const usedModel = opening !== null && closing !== null
        const draft = composeOffer(
            {
                candidate: candidateName,
                shop,
                title: terms.title === "" ? job.title : terms.title,
                terms: termsBlock(job, terms, OFFER_DAYS, this.pay(job), this.words.textOf),
                opening: usedModel ? opening : null,
                closing: usedModel ? closing : null,
            },
            this.words.textOf,
        )
        return { draft, usedModel }
    }

    /** Writes the offer terms and a letter, and asks the gate to send it; the owner approves before it goes out. */
    async request(userId: string, workspaceId: string, request: RequestOfferParams): Promise<RequestOfferOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const candidate = await this.candidates.requireOpenCandidate(workspaceId, request.candidateId)
        if (await this.data.hasActiveOffer(candidate.id)) throw new HiringError({ code: HiringErrorCode.OfferOpen })
        const terms: OfferTerms = {
            title: clip(request.title, TITLE_MAX),
            pay: clip(request.pay, PAY_MAX),
            startDate: clip(request.startDate, START_MAX),
            probation: clip(request.probation, PROBATION_MAX),
            note: clip(request.note, NOTE_MAX),
        }
        if (terms.pay === "") throw new HiringError({ code: HiringErrorCode.OfferPayRequired })
        const found = findFairnessViolations(`${terms.title} ${terms.note}`)[0]
        if (found !== undefined) {
            throw new HiringError({
                code: HiringErrorCode.Unfair,
                params: {
                    detail: this.words.text("hiring.fairness.offer", {
                        trait: this.words.text(`hiring.fairness.${found.category}`),
                    }),
                },
            })
        }
        const job = await this.requireJob(workspaceId, candidate.jobId)
        const [created] = await this.entityManager.query<Array<IdRow>>(CREATE_OFFER, [
            workspaceId,
            candidate.id,
            job.id,
            JSON.stringify(termsJson(terms)),
            await this.data.newToken(),
            userId,
        ])
        if (created?.id === null || created?.id === undefined)
            throw new HiringError({ code: HiringErrorCode.OfferNotFound })
        const { draft, usedModel } = await this.letter(workspaceId, candidate.name, job, terms)
        const outcome = await this.gate.request({
            workspaceId,
            actor: displayName,
            action: "send_offer",
            subjectType: "candidate",
            subjectId: candidate.id,
            dedupeKey: `send_offer:${created.id}`,
            summary: this.words.text(usedModel ? "hiring.offer.summary" : "hiring.offer.summaryTemplate", {
                name: candidate.name,
                title: terms.title === "" ? job.title : terms.title,
                pay: terms.pay,
            }),
            draft,
            fields: {
                candidate_id: candidate.id,
                offer_id: created.id,
                contact: candidate.email === "" ? candidate.phone : candidate.email,
            },
        })
        const status = STATUS_OF_DECISION[outcome.status] ?? "draft"
        await this.entityManager.query(LINK_OFFER, [workspaceId, created.id, outcome.workItemId, status])
        return {
            status: outcome.status,
            summary: this.words.text("hiring.offer.asked", { name: candidate.name }),
            error: null,
        }
    }

    /** The performer of send_offer, after approval: sends the letter with the reply link and moves the candidate to the offer stage. */
    async perform(context: PerformContext): Promise<PerformResult> {
        const { workspaceId } = context
        const offer = await this.requireOffer(workspaceId, fieldText(context.fields, "offer_id"))
        const candidate = await this.candidates.requireCandidate(workspaceId, offer.candidateId)
        const job = await this.requireJob(workspaceId, offer.jobId)
        const shop = await this.office.workspaceName(workspaceId)
        const body =
            (context.draft ?? "").trim() ||
            composeOffer(
                {
                    candidate: candidate.name,
                    shop,
                    title: offer.terms.title === "" ? job.title : offer.terms.title,
                    terms: termsBlock(job, offer.terms, OFFER_DAYS, this.pay(job), this.words.textOf),
                    opening: null,
                    closing: null,
                },
                this.words.textOf,
            )
        const link = this.links.offer(offer.token)
        const delivery = await this.notify.toCandidate(candidate, {
            subject: this.words.text("hiring.offer.subject", {
                title: offer.terms.title === "" ? job.title : offer.terms.title,
            }),
            text: `${body}\n\n${this.words.text("hiring.offer.replyAt", { link })}`,
            workItemId: context.workItemId,
        })
        await this.entityManager.query<Array<FlagRow>>(MARK_OFFER_SENT, [
            workspaceId,
            offer.id,
            body,
            delivery.via,
            addDays(this.clock.now(), OFFER_DAYS).toISOString(),
            context.actor,
            this.words.text("hiring.event.offerSent", { actor: context.actor, note: delivery.note }),
        ])
        return {
            summary: this.words.text("hiring.offer.sent", { name: candidate.name, note: delivery.note }),
            evidence: "captured",
            ...(delivery.delivered ? {} : { detail: link }),
        }
    }

    /** The owner did not approve the letter: the offer is cancelled and the candidate stays where they were. */
    async reject(context: PerformContext): Promise<void> {
        await this.entityManager.query<Array<CancelledOfferRow>>(CANCEL_OFFER, [
            context.workspaceId,
            fieldText(context.fields, "offer_id"),
            ["draft", "waiting"],
            context.actor,
            this.words.text("hiring.event.offerNotApproved"),
        ])
    }

    /** Cancels an offer that is a draft, waiting or sent, and drops the decision it waits for. */
    async cancel(userId: string, workspaceId: string, request: CancelOfferParams): Promise<void> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const [row] = await this.entityManager.query<Array<CancelledOfferRow>>(CANCEL_OFFER, [
            workspaceId,
            request.id,
            ["draft", "waiting", "sent"],
            displayName,
            this.words.text("hiring.event.offerCancelled"),
        ])
        if (row === undefined) throw new HiringError({ code: HiringErrorCode.OfferNotCancellable })
        if (row.work_item_id !== null) {
            await this.gate.decide({
                workspaceId,
                workItemId: row.work_item_id,
                decision: "rejected",
                decidedBy: userId,
            })
        }
    }

    /** Resolves the secret link to its stored offer, including historical states. */
    async authenticateLink(token: string): Promise<CredentialPrincipal> {
        return hiringLinkPrincipal(isToken(token) ? await this.data.offerByToken(token) : undefined)
    }

    /** What a candidate sees on the link of an offer. */
    async publicView(request: PublicOfferParams, principal?: CredentialPrincipal): Promise<PublicOfferOutput> {
        if (principal !== undefined) requireHiringLinkBinding(principal, await this.authenticateLink(request.token))
        const offer = isToken(request.token) ? await this.data.offerByToken(request.token) : undefined
        if (offer === undefined || HIDDEN_STATUSES.has(offer.status))
            throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        const heads = await this.data.heads(offer.candidateId, offer.jobId)
        if (heads === undefined) throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        return {
            status: offer.status,
            candidateName: heads.candidateName,
            jobTitle: heads.jobTitle,
            location: heads.jobLocation,
            shop: await this.office.workspaceName(offer.workspaceId),
            letter: offer.draft,
            expiresAt: offer.expiresAt,
            terms: {
                title: offer.terms.title,
                pay: offer.terms.pay,
                startDate: offer.terms.startDate,
                probation: offer.terms.probation,
                note: offer.terms.note,
            },
        }
    }

    private expired(offer: OfferRecord): boolean {
        return offer.expiresAt !== null && Date.parse(offer.expiresAt) < this.clock.now().getTime()
    }

    /** The candidate answers a sent offer: accepting makes them hired with the onboarding checklist, declining withdraws them. */
    async respond(request: RespondOfferParams, principal?: CredentialPrincipal): Promise<RespondOfferOutput> {
        const offer = isToken(request.token) ? await this.data.offerByToken(request.token) : undefined
        if (offer === undefined) return { outcome: "invalid" }
        if (principal !== undefined) requireHiringLinkBinding(principal, hiringLinkPrincipal(offer))
        if (HIDDEN_STATUSES.has(offer.status)) return { outcome: "invalid" }
        if (offer.status === "accepted") return { outcome: "already_accepted" }
        if (offer.status === "declined") return { outcome: "already_declined" }
        if (offer.status === "expired") return { outcome: "expired" }
        if (offer.status !== "sent") return { outcome: "closed" }
        if (this.expired(offer)) return { outcome: "expired" }
        const candidate = await this.data.candidateHead(offer.candidateId)
        const job = await this.data.jobHead(offer.jobId)
        const name = candidate?.name ?? ""
        const title = job?.title ?? ""
        const items = Array.from({ length: ONBOARDING_STEPS }, (_, index) =>
            this.words.text(`hiring.onboarding.${index + 1}`),
        )
        const [row] = await this.entityManager.query<Array<TextRow>>(ANSWER_OFFER, [
            request.token,
            request.accept,
            items,
            name,
            this.words.text(request.accept ? "hiring.event.offerAccepted" : "hiring.event.offerDeclined"),
        ])
        if (row?.value !== "accepted" && row?.value !== "declined") return { outcome: "stale" }
        await this.office.postOffice(
            offer.workspaceId,
            this.words.text(request.accept ? "hiring.office.offerAccepted" : "hiring.office.offerDeclined", {
                name,
                title,
            }),
        )
        if (request.accept) await this.candidates.closeJobIfFilled(offer.workspaceId, offer.jobId)
        return { outcome: request.accept ? "accepted" : "declined" }
    }
}
