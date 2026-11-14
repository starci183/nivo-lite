import { TOOL } from "@nivo-lite/agent-sdk/names"
import { mutatesBySpec } from "@modules/domain/tool-specs"
import { CORE_TOOL_IDS } from "@modules/domain/tool-specs/tool-specs.policy"
import {
    PROVIDER_CATALOGUE,
    isProviderTool,
    isChannelBound,
    isProviderParted,
    mutatesOf,
} from "./provider-abilities.policy"
import { isNodePlacedTool } from "./agent-accounts.service"
import { takesOneAccount } from "./tool-runner.service"

/**
 * The runner's one-account rule, read off the catalogue and the registry: a tool on a provider's list it does not place itself, unless
 * the registry knows it as a read (an id the registry does not hold is no read to the runner).
 */
const catalogueTakesOne = (tool: string): boolean =>
    isProviderTool(tool) && !isChannelBound(tool) && !isProviderParted(tool) && mutatesBySpec(tool) !== false

/** Every id the catalogue reaches besides the core ids (the sources' declared tools), and ids no table holds. */
const OTHER_IDS: ReadonlyArray<string> = [
    ...new Set(PROVIDER_CATALOGUE.flatMap((spec) => spec.abilities.flatMap((ability) => ability.tools))),
    "nivo.api.crm.nivoweb.get.prices",
]

/** An id no table holds: no core spec, no catalogue holder, no ability. */
const UNKNOWN_ID = "nivo.tool.nothing.here"

/**
 * The provider purposes registered after the flip (2026-11-13: the domain registrars, speech, dubbing, video, the calendar and the destinations): they had no "before",
 * so the registry's own account mode is their only rule (`tool-specs.policy.spec.ts` states each); they are out of the identity below.
 */
const NEW_PURPOSES: ReadonlySet<string> = new Set([
    // The invoice purpose keeps its adapter slot but no provider holds it any more (owner chốt 2026-11-13: a CRM serves its generated
    // operations only), so the catalogue says nothing of it; the registry's own `account: "any"` is its only rule.
    TOOL.invoiceCreate,
    TOOL.domainAvailabilityGet,
    TOOL.domainGet,
    TOOL.domainList,
    TOOL.domainRegistrationCreate,
    TOOL.domainRenewalCreate,
    TOOL.domainTransferCreate,
    TOOL.domainDnsRecordList,
    TOOL.domainDnsRecordCreate,
    TOOL.domainDnsRecordUpdate,
    TOOL.domainDnsRecordDelete,
    TOOL.domainNameserverUpdate,
    TOOL.speechGenerate,
    TOOL.speechVoiceList,
    TOOL.dubbingCreate,
    TOOL.dubbingGet,
    TOOL.videoGenerate,
    TOOL.videoGenerationGet,
    // The cloud video compose purposes (shotstack, creatomate, json2video; 2026-11-13): no "before" either.
    TOOL.videoCompose,
    TOOL.videoRenderGet,
    // The calendar and the destinations (registered with the provider worker's lines): no "before" either.
    TOOL.calendarSlotFreeList,
    TOOL.calendarEventCreate,
    TOOL.calendarEventUpdate,
    TOOL.calendarEventCancel,
    TOOL.facebookPostPublish,
    TOOL.instagramMediaPublish,
    TOOL.instagramMediaStatusGet,
    TOOL.youtubeVideoPublish,
    TOOL.youtubeVideoStatusGet,
    TOOL.tiktokVideoPublish,
    TOOL.tiktokVideoStatusGet,
    TOOL.tiktokCreatorInfoGet,
    // The bank-transfer instruction (registered with the payment tools, 2026-11-13; a read of the `sepay` catalogue, `transfer.instruction`):
    // no "before" either; the registry's `account: "any"` is its only rule.
    TOOL.paymentTransferCreate,
    // One bank move of ONE bound bank account (`nivo.tool.payment.credit.get`, 2026-11-13; a read on `transactions.read` of sepay, casso and
    // payos): no "before" either; the registry's `account: "any"` is its only rule.
    TOOL.paymentCreditGet,
    // The payment-link purpose (2026-11-13; its own purpose beside the transfer instruction, served by payos): no "before" either; the
    // registry's `account: "any"` is its only rule.
    TOOL.paymentLinkCreate,
    TOOL.paymentLinkGet,
    TOOL.paymentLinkCancel,
])

describe("the runner and the bound accounts read the tool specs, with the same answers as before", () => {
    it.each(CORE_TOOL_IDS)("%s: whether it writes is the registry's own `mutates`", (tool) => {
        expect(mutatesOf(tool)).toBe(mutatesBySpec(tool))
    })

    it.each([...CORE_TOOL_IDS, ...OTHER_IDS].filter((tool) => !NEW_PURPOSES.has(tool)))("%s: one account", (tool) => {
        expect(takesOneAccount(tool)).toBe(catalogueTakesOne(tool))
    })

    // Ledger (nivo-frame `templates`, the node lists its providers): an id no table holds is placed by its NODE, not by the catalogue,
    // so it is out of the catalogue identity above. It may take the accounts its step's node lists (`takesOneAccount`), and only there:
    // outside a step the bound-accounts reader answers none for a node-placed tool (`boundAccountsOf`, `listsProviders`).
    it("an id no table holds takes accounts only as its node places them: none outside a step", () => {
        expect(isNodePlacedTool(UNKNOWN_ID)).toBe(true)
        expect(takesOneAccount(UNKNOWN_ID)).toBe(true)
    })

    it("hands one account to the writes on a provider's list, the payment request and the provider purposes on one account, never to a send, a merged read or NIVO's own tools", () => {
        expect(CORE_TOOL_IDS.filter((tool) => takesOneAccount(tool)).sort()).toEqual(
            [
                TOOL.ledgerEntryAppend,
                TOOL.ledgerEntryVoid,
                TOOL.mailMessageSend,
                // flipDecisions2026_11_13 (ledger: was NIVO's own, no account): the invoice purpose is handed ONE account by its spec (`any`);
                // no CRM serves it any more (owner chốt 2026-11-13), so no account of a provider holds it until an adapter does.
                TOOL.invoiceCreate,
                // The provider purposes on ONE bound account (`any`), a read included: a call about a name not held yet, a page of
                // one registrar account, every speech, dubbing and video call. A call about a held domain finds its own (`owner`).
                TOOL.domainAvailabilityGet,
                TOOL.domainList,
                TOOL.domainRegistrationCreate,
                TOOL.domainTransferCreate,
                TOOL.speechGenerate,
                TOOL.speechVoiceList,
                TOOL.dubbingCreate,
                TOOL.dubbingGet,
                TOOL.videoGenerate,
                TOOL.videoGenerationGet,
                TOOL.videoCompose,
                TOOL.videoRenderGet,
                // The calendar and the destinations (provider worker): every call, a read included, asks ONE bound account of its owner.
                TOOL.calendarSlotFreeList,
                TOOL.calendarEventCreate,
                TOOL.calendarEventUpdate,
                TOOL.calendarEventCancel,
                TOOL.facebookPostPublish,
                TOOL.instagramMediaPublish,
                TOOL.instagramMediaStatusGet,
                TOOL.youtubeVideoPublish,
                TOOL.youtubeVideoStatusGet,
                TOOL.tiktokVideoPublish,
                TOOL.tiktokVideoStatusGet,
                TOOL.tiktokCreatorInfoGet,
                // The transfer instruction reads ONE bound SePay account (`any`): the QR is composed from that account's public fields.
                TOOL.paymentTransferCreate,
                // One bank move reads ONE bound bank account (`any`): the row must be that account's.
                TOOL.paymentCreditGet,
                // The payment link is made, read and cancelled on ONE bound payOS account (`any`).
                TOOL.paymentLinkCreate,
                TOOL.paymentLinkGet,
                TOOL.paymentLinkCancel,
            ].sort(),
        )
    })
})
