import { TOOL, crmIdOfOp, crmProviderKeyOf, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    DOMAIN_TOOL_BUSINESS_REFUSALS,
    MEDIA_TOOL_BUSINESS_REFUSALS,
    PAYMENT_TOOL_BUSINESS_REFUSALS,
} from "@modules/domain/provider-registry"
import type {
    CoreToolId,
    OptionalToolSpec,
    RefusalsOf,
    ToolAccountMode,
    ToolAdapterSlot,
    ToolAvailability,
    ToolDataKind,
    ToolRefusals,
    ToolSpec,
    ToolSpecRegistry,
} from "./tool-specs.contracts"

/** The pseudo-provider of NIVO's own tools (ruling B2): it owns every tool no provider owns, is always bound and never attachable. */
export const NIVO_OWNER: string = "nivo"

/**
 * The owner a platform purpose names when a CRM may serve it (`nivo.tool.invoice.create`): it stands for every CRM the installed packages
 * declare (`crm.<id>`, read from their provider templates, never an id of the engine), so a node that lists a CRM is judged on the purpose.
 * No CRM serves a purpose since 2026-11-13 (its spec's availability is `pinned-mark` and no pin marks one): readiness blocks such a node
 * (`tool_unavailable`) until a provider adapter serves it.
 */
const CRM = "crm"

/** The refusals the run's pin answers on the effect road for every effect (`effect-pin.policy.ts` `PinRefusal`). */
export const PIN_REFUSALS = ["conversation_mismatch", "lead_mismatch", "conversation_unverified"] as const

/**
 * The refusals of the setup the door answers on the effect road (`AbilityVerdict` refuse reasons): the agent is attached to no account
 * serving the tool (the kill switch), or the step's node states no readable mode (no default). They FREEZE the step on the template
 * road, so they are in no tool's refusal set (`FROZEN_RIGHT_REFUSALS`).
 */
export const HELD_RIGHT_REFUSALS = ["not_attached", "node_mode_unknown"] as const

/**
 * The refusals of the agent's rights and of the setup the door judges on the effect road: on the template road each FREEZES the step
 * (the door throws `GRAPH_NODES_TOOL_NOT_GRANTED`), so none is a typed refusal of any tool (`tool-specs.policy.spec.ts` proves it).
 */
export const FROZEN_RIGHT_REFUSALS = [...HELD_RIGHT_REFUSALS] as const

/**
 * The old refusal of a second customer line for the same stop. Nothing answers it any more (a step that runs again answers its
 * earlier send from that send's receipt, nivo-frame `rights` 11d); it stays listed only because the agent-sdk send signature
 * (`packages/agent-sdk/src/names/tool.ts`) still types it, and every code the SDK types must be listed here. Drop both together.
 */
export const REPEAT_SEND_REFUSALS = ["already_told_for_this_stop"] as const

/** What the customer send's executor answers (`chat-node-ports.policy.ts` `SEND_REFUSAL`, every value). */
export const SEND_REFUSALS = [
    "no_recipient",
    "no_channel_identity",
    "channel_ambiguous",
    "route_held",
    "connection_missing",
    "channel_no_access",
    "customer_opted_out",
    "recipient_not_linked",
    "outside_window",
    "plan_blocked",
    "not_delivered",
] as const

/** What a write to a contact answers (`ContactWriteRefusal`, every value). */
export const CONTACT_WRITE_REFUSALS = ["contact_missing", "other_contact"] as const

/**
 * What linking an identity answers to a node (`ContactIdentityLinkRefusal`, every value): the BUSINESS refusals only. `internal_only` (an
 * outside identity linked from a run that serves a customer) and `ask_only` (an outside identity with no person's approval) are classed
 * `infrastructure` by the native (`NATIVE_REFUSAL_CLASS`): they freeze the step, so no node reads them and no set lists them.
 */
export const CONTACT_LINK_REFUSALS = [
    ...CONTACT_WRITE_REFUSALS,
    "identity_invalid",
    "identity_taken",
    "token_invalid",
    "account_missing",
] as const

/** What merging two contacts answers (`ContactMergeRefusal`, every value). */
export const CONTACT_MERGE_REFUSALS = ["contact_missing", "same_contact", "no_proof"] as const

/** Why an order may not be cancelled (blocks-core `CancelRefusal`, every value). */
export const CANCEL_RULE_REFUSALS = [
    "order_not_cancellable",
    "order_paid",
    "order_invoiced",
    "order_has_payment",
    "order_has_invoice",
] as const

/** Why the books refuse a settlement (blocks-core `SettleRefusal`, every value). */
export const SETTLE_RULE_REFUSALS = [
    "transaction_missing",
    "order_missing",
    "transaction_not_credit",
    "order_not_open",
    "order_unpriced",
    "transaction_used",
    "claim_missing",
    "claim_closed",
] as const

/** The registrars that serve the generic domain purposes (`nivo.tool.domain.*`): providers are equal, the node's order picks. */
const REGISTRARS: ReadonlyArray<string> = ["inet", "tino"]

/** The speech and dubbing service that serves `nivo.tool.speech.*` and `nivo.tool.dubbing.*`. */
const SPEECH: ReadonlyArray<string> = ["elevenlabs"]

/** The video generation service that serves `nivo.tool.video.generate` and `nivo.tool.video.generation.get`. */
const VIDEO: ReadonlyArray<string> = ["veo"]

/** The cloud compose services that serve `nivo.tool.video.compose` and `.render.get`: providers are equal, the node's order picks. */
const COMPOSERS: ReadonlyArray<string> = ["shotstack", "creatomate", "json2video"]

/** The providers that serve the generic calendar tools (`nivo.tool.calendar.*`) and the YouTube destination: the Google account. */
const GOOGLE: ReadonlyArray<string> = ["google"]

/** The provider that serves the Facebook and Instagram destination tools: the Meta account (a Page and its linked Instagram). */
const META: ReadonlyArray<string> = ["meta"]

/** The provider that serves the TikTok destination tools. */
const TIKTOK: ReadonlyArray<string> = ["tiktok"]

/** The engine's refusals of an effect no provider serves: the pin. */
const OWN_EFFECT = [...PIN_REFUSALS] as const

/** A closed refusal set of the codes `R`. */
interface ClosedRefusals<R extends string> {
    readonly closed: true
    readonly codes: ReadonlyArray<R>
}

/** An open refusal set. */
interface OpenRefusals {
    readonly closed: false
    readonly codes: ReadonlyArray<string>
}

/** A spec with its refusal set's own type and whether it writes as written, as the registry's checks read them. */
type SpecWith<F extends ToolRefusals, M extends boolean = boolean> = Omit<ToolSpec, "refusals" | "mutates"> & {
    readonly mutates: M
    readonly refusals: F
}

/** A closed set: every code the tool can answer. */
const closed = <const R extends string>(...codes: ReadonlyArray<R>): ClosedRefusals<R> => ({ closed: true, codes })

/** The business refusals of a calendar or destination tool: the platform refused the request, or the id is not there. */
const PUBLISH_REFUSALS = closed("rejected", "not_found")

/** An open set: the codes known by reading; the tool may answer others (its adapter's refusals are free text). */
const open = (...codes: ReadonlyArray<string>): OpenRefusals => ({ closed: false, codes })

/** The parts of a spec most tools share, filled by the helpers below. */
interface SpecParts<F extends ToolRefusals> {
    readonly owners?: ReadonlyArray<string>
    readonly account?: ToolAccountMode
    readonly dataKind?: ToolDataKind | null
    readonly onceBy?: ReadonlyArray<string>
    readonly adapter?: ToolAdapterSlot
    readonly availability?: ToolAvailability
    readonly approvalContent?: ReadonlyArray<string>
    readonly refusals: F
}

/** A spec, engine-owned and on no account unless the parts say otherwise: `mutates` false for a read, true for a write. */
const specOf = <M extends boolean, F extends ToolRefusals>(mutates: M, parts: SpecParts<F>): SpecWith<F, M> => ({
    mutates,
    owners: parts.owners ?? [NIVO_OWNER],
    account: parts.account ?? "none",
    dataKind: parts.dataKind ?? null,
    onceBy: parts.onceBy ?? [],
    refusals: parts.refusals,
    adapter: parts.adapter ?? null,
    availability: parts.availability ?? "bound",
    ...(parts.approvalContent === undefined ? {} : { approvalContent: parts.approvalContent }),
})

/** A read: it only looks. */
const readSpec = <F extends ToolRefusals>(parts: SpecParts<F>): SpecWith<F, false> => specOf(false, parts)

/** A write: anything that is no read (nothing else of what a tool does is the engine's). */
const writeSpec = <F extends ToolRefusals>(parts: SpecParts<F>): SpecWith<F, true> => specOf(true, parts)

/** The refusals a native read is known to answer; on the tool road a native refusal is a tool error today (the node freezes). */
const nativeRead = (dataKind: ToolDataKind | null, ...codes: ReadonlyArray<string>): SpecWith<OpenRefusals, false> =>
    readSpec({ dataKind, refusals: open(...codes) })

/**
 * Every core tool's spec, keyed by `TOOL`. A TOTAL record: a `TOOL` id without its spec does not compile, and a closed refusal set must
 * equal the SDK's `ToolNames[id]["refusals"]` union (`tool-specs.policy.spec.ts` proves the rest against the scattered tables it replaces).
 */
export const TOOL_SPECS = {
    // Customer and conversation.
    [TOOL.customerMessageSend]: writeSpec({
        owners: ["zalo_oa", "telegram", "meta"],
        account: "owner",
        approvalContent: ["text", "images"],
        refusals: closed(...SEND_REFUSALS, ...REPEAT_SEND_REFUSALS, ...PIN_REFUSALS),
    }),
    [TOOL.leadCareGet]: nativeRead(null, "other_lead"),
    [TOOL.leadOrderList]: nativeRead(null, "other_conversation", "other_lead"),
    // The contact (the engine's person).
    [TOOL.contactGet]: nativeRead(null, "other_conversation", "other_contact"),
    [TOOL.contactSearch]: nativeRead(null),
    [TOOL.contactUpdate]: writeSpec({ refusals: closed(...CONTACT_WRITE_REFUSALS) }),
    [TOOL.contactMemoryRemember]: writeSpec({ refusals: closed(...CONTACT_WRITE_REFUSALS) }),
    [TOOL.contactIdentityLink]: writeSpec({ refusals: closed(...CONTACT_LINK_REFUSALS) }),
    [TOOL.contactMerge]: writeSpec({ refusals: closed(...CONTACT_MERGE_REFUSALS) }),
    [TOOL.conversationMessageList]: nativeRead(null, "other_conversation", "other_lead"),
    [TOOL.customerProfileGet]: nativeRead(null, "not_found"),
    // Catalogue and orders.
    [TOOL.orderGet]: nativeRead("payments", "not_found", "other_lead"),
    [TOOL.orderOpenList]: nativeRead("payments"),
    // Payments.
    [TOOL.paymentCreditList]: readSpec({
        owners: ["sepay", "casso"],
        account: "each",
        dataKind: "payments",
        refusals: open(),
    }),
    // One bank move of ONE attached account of a bank feed (SePay, Casso, payOS answer the same shape), from its raw row: a read.
    [TOOL.paymentCreditGet]: readSpec({
        owners: ["sepay", "casso", "payos"],
        account: "any",
        dataKind: "payments",
        refusals: open(...PAYMENT_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.paymentDebitList]: readSpec({
        owners: ["sepay"],
        account: "each",
        dataKind: "payments",
        refusals: open(),
    }),
    [TOOL.paymentClaimList]: nativeRead("payments"),
    // The generic bank-transfer instruction (QR and account details) of the workspace's receiving account, on ONE bound account of a bank
    // provider that registers a payment-instruction port. A READ by what its adapters do (SePay composes the address from the connection's
    // own details and calls nothing). Its closed-by-reading business refusals are the leaf list of the provider registry.
    [TOOL.paymentTransferCreate]: readSpec({
        owners: ["sepay"],
        account: "any",
        refusals: open(...PAYMENT_TOOL_BUSINESS_REFUSALS),
    }),
    // The payment LINK purpose (its own, never merged into the transfer instruction): a hosted link CREATED at the provider under the provider's
    // own order code, so create and cancel WRITE (the node's declared mode applies) and get reads. Served by payOS, on ONE bound account.
    // Business refusals are the leaf list of the provider registry; an infrastructure refusal freezes the step; a signed POST that timed out
    // proves `unknown` and stops for a person (never sent again by itself).
    [TOOL.paymentLinkCreate]: writeSpec({
        owners: ["payos"],
        account: "any",
        refusals: open(...PAYMENT_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.paymentLinkGet]: readSpec({
        owners: ["payos"],
        account: "any",
        refusals: open(...PAYMENT_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.paymentLinkCancel]: writeSpec({
        owners: ["payos"],
        account: "any",
        refusals: open(...PAYMENT_TOOL_BUSINESS_REFUSALS),
    }),
    // The generic timers: the engine's own (no account); a timer wakes the agent's own graph after the run ended. Arming an armed ref
    // replaces its instant; bounds are the schema's, so a refusal is an invalid argument (no business refusal).
    [TOOL.timerArm]: writeSpec({ refusals: open() }),
    [TOOL.timerCancel]: writeSpec({ refusals: open() }),
    [TOOL.bankTransactionList]: readSpec({
        owners: ["sepay"],
        account: "each",
        dataKind: "payments",
        refusals: open(),
    }),
    // The team, the work and the day.
    [TOOL.teamMessagePost]: writeSpec({
        refusals: open(
            "kind_not_postable",
            "order_missing",
            "not_paid",
            "not_person_line",
            "other_room",
            ...OWN_EFFECT,
        ),
    }),
    [TOOL.agentTag]: writeSpec({ refusals: closed(...OWN_EFFECT) }),
    [TOOL.teamChatReportPost]: writeSpec({ refusals: open() }),
    // The books.
    [TOOL.ledgerEntryAppend]: writeSpec({
        owners: ["google"],
        account: "any",
        refusals: open("not_found"),
    }),
    [TOOL.ledgerEntryVoid]: writeSpec({
        owners: ["google"],
        account: "any",
        refusals: open("not_found"),
    }),
    [TOOL.ledgerStatusGet]: readSpec({ owners: ["google"], account: "each", refusals: open() }),
    [TOOL.connectionStatusGet]: readSpec({ owners: ["sepay"], account: "each", refusals: open() }),
    [TOOL.driveStatusGet]: readSpec({
        owners: ["google"],
        account: "each",
        dataKind: "documents",
        refusals: open(),
    }),
    [TOOL.driveSourceList]: readSpec({
        owners: ["google"],
        account: "each",
        dataKind: "documents",
        refusals: open(),
    }),
    // A platform purpose with the OpenAPI adapter slot (TOOLS-LEAD §1c, coordinator 2026-11-12): a source's document serves it by its mark
    // (the CRM, which mocks MISA). flipDecisions2026_11_13: it keeps the slot and is UNAVAILABLE while no source serves it: its owners are
    // the source that may serve it (`crm`), its account `any`, and only an account whose PINNED document marks the purpose serves it
    // (`pinned-mark`), so readiness hides a graph that needs it (`tool_unavailable`) while no attached document marks it (NIVO Web's CRM
    // does not yet). A write: it runs in the mode its node declares.
    [TOOL.invoiceCreate]: writeSpec({
        owners: [CRM],
        account: "any",
        adapter: "openapi",
        availability: "pinned-mark",
        refusals: open(),
    }),
    [TOOL.einvoiceList]: nativeRead("invoices"),
    [TOOL.einvoiceGet]: nativeRead("invoices"),
    // The second brain.
    [TOOL.brainSearch]: nativeRead("brain"),
    [TOOL.brainFactGet]: nativeRead("brain", "not_found"),
    [TOOL.brainFactList]: nativeRead("brain"),
    [TOOL.brainFactRelated]: nativeRead("brain", "not_found"),
    [TOOL.brainPassageSearch]: nativeRead("brain"),
    [TOOL.brainPassageRead]: nativeRead("brain", "not_found"),
    [TOOL.brainDocumentRead]: nativeRead("brain", "not_found"),
    [TOOL.brainChangePropose]: writeSpec({
        dataKind: "brain",
        refusals: open("quote_not_said", "not_found"),
    }),
    // Mail.
    [TOOL.mailMessageList]: readSpec({
        owners: ["imap"],
        account: "each",
        dataKind: "mail",
        refusals: open("not_found"),
    }),
    [TOOL.mailMessageGet]: readSpec({
        owners: ["imap"],
        account: "each",
        dataKind: "mail",
        refusals: open("not_found"),
    }),
    // It sends; it runs in the mode its node declares (on `ask` the engine interrupts before the tool is called).
    [TOOL.mailMessageSend]: writeSpec({
        owners: ["smtp"],
        account: "any",
        dataKind: "mail",
        refusals: open("other_lead"),
    }),
    // Domains: the generic domain purposes, served by every registrar that registers a `DomainRegistrarPort`. A call about a name the
    // workspace does not hold yet (availability, a page of one account, a registration, a transfer in) takes ONE bound account (`any`);
    // a call about a held domain acts on the account that holds it (`owner`: the tools find it by the domain, `domain-owner.policy.ts`).
    [TOOL.domainAvailabilityGet]: readSpec({
        owners: REGISTRARS,
        account: "any",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainGet]: readSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainList]: readSpec({
        owners: REGISTRARS,
        account: "any",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainRegistrationCreate]: writeSpec({
        owners: REGISTRARS,
        account: "any",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainRenewalCreate]: writeSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainTransferCreate]: writeSpec({
        owners: REGISTRARS,
        account: "any",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainDnsRecordList]: readSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainDnsRecordCreate]: writeSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainDnsRecordUpdate]: writeSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainDnsRecordDelete]: writeSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.domainNameserverUpdate]: writeSpec({
        owners: REGISTRARS,
        account: "owner",
        dataKind: "domains",
        refusals: open(...DOMAIN_TOOL_BUSINESS_REFUSALS),
    }),
    // Media: the generic speech, dubbing and video purposes, each on ONE bound account of a provider that serves it.
    [TOOL.speechGenerate]: writeSpec({
        owners: SPEECH,
        account: "any",
        dataKind: "media",
        refusals: open(...MEDIA_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.speechVoiceList]: readSpec({
        owners: SPEECH,
        account: "any",
        dataKind: "media",
        refusals: open(...MEDIA_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.dubbingCreate]: writeSpec({
        owners: SPEECH,
        account: "any",
        dataKind: "media",
        refusals: open(...MEDIA_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.dubbingGet]: readSpec({
        owners: SPEECH,
        account: "any",
        dataKind: "media",
        refusals: open(...MEDIA_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.videoGenerate]: writeSpec({
        owners: VIDEO,
        account: "any",
        dataKind: "media",
        refusals: open(...MEDIA_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.videoGenerationGet]: readSpec({
        owners: VIDEO,
        account: "any",
        dataKind: "media",
        refusals: open(...MEDIA_TOOL_BUSINESS_REFUSALS),
    }),
    [TOOL.videoCompose]: writeSpec({
        owners: COMPOSERS,
        account: "any",
        dataKind: "media",
        refusals: closed("invalid_spec", "provider_refused"),
    }),
    [TOOL.videoRenderGet]: readSpec({
        owners: COMPOSERS,
        account: "any",
        dataKind: "media",
        refusals: closed("not_found"),
    }),
    // The generic record tools (BIZ-MOVE G2): NIVO's own, on no account, over every record type a package declares with `defineEntity`;
    // each reaches only the records of the calling agent. The closed sets are every BUSINESS code the adapter answers
    // (`RECORD_REFUSAL_CLASS` of `native-tools/record-native.policy.ts`); `type_read_only` and `not_served` are infrastructure (the step
    // freezes) and are in no set.
    [TOOL.recordGet]: readSpec({ refusals: closed("type_unknown", "not_found") }),
    [TOOL.recordList]: readSpec({ refusals: closed("type_unknown", "query_invalid", "query_not_indexed") }),
    [TOOL.recordCreate]: writeSpec({ refusals: closed("type_unknown", "invalid_value", "taken") }),
    [TOOL.recordUpdate]: writeSpec({
        refusals: closed("type_unknown", "not_found", "invalid_value", "taken", "stale"),
    }),
    // The generic file tools (BIZ-MOVE G3): the engine's own file store, on no account, over every `file` field a package declares with
    // `defineEntity`; put and link WRITE the record, get READS it; each reaches only the calling agent's own records. The closed sets are
    // every BUSINESS code of `FILE_REFUSAL_CLASS` (`native-tools/file-native.policy.ts`); `not_served` and `store_unavailable` are
    // infrastructure (the step freezes) and are in no set.
    [TOOL.filePut]: writeSpec({
        refusals: closed(
            "type_unknown",
            "field_not_file",
            "not_found",
            "mime_not_accepted",
            "too_big",
            "key_invalid",
            "object_missing",
            "url_invalid",
            "url_unreachable",
            "quota_exceeded",
            "record_rejected",
        ),
    }),
    [TOOL.fileLink]: writeSpec({
        refusals: closed(
            "type_unknown",
            "field_not_file",
            "not_found",
            "mime_not_accepted",
            "too_big",
            "key_invalid",
            "object_missing",
            "quota_exceeded",
            "record_rejected",
        ),
    }),
    [TOOL.fileGet]: readSpec({
        refusals: closed("type_unknown", "field_not_file", "not_found", "no_file", "key_invalid"),
    }),
    // The calendar and the destinations (provider worker, BIZ-MOVE 1-D): each runs on the account of its owner provider, whichever the
    // node lists (`account: "any"`). The closed set is every BUSINESS code the adapters answer (`CALENDAR_BUSINESS_REFUSALS`,
    // `SOCIAL_BUSINESS_REFUSALS`); a missing credential or consent (`not_connected`, `connection_refused`, `not_available`) freezes the step.
    // The calendar holds no store kind (the free slots are computed from the calendar's own busy time), so a governed agent's data right
    // does not judge it; a destination's kind is the media's.
    [TOOL.calendarSlotFreeList]: readSpec({ owners: GOOGLE, account: "any", refusals: PUBLISH_REFUSALS }),
    [TOOL.calendarEventCreate]: writeSpec({ owners: GOOGLE, account: "any", refusals: PUBLISH_REFUSALS }),
    [TOOL.calendarEventUpdate]: writeSpec({ owners: GOOGLE, account: "any", refusals: PUBLISH_REFUSALS }),
    [TOOL.calendarEventCancel]: writeSpec({ owners: GOOGLE, account: "any", refusals: PUBLISH_REFUSALS }),
    [TOOL.facebookPostPublish]: writeSpec({
        owners: META,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.instagramMediaPublish]: writeSpec({
        owners: META,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.instagramMediaStatusGet]: readSpec({
        owners: META,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.youtubeVideoPublish]: writeSpec({
        owners: GOOGLE,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.youtubeVideoStatusGet]: readSpec({
        owners: GOOGLE,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.tiktokVideoPublish]: writeSpec({
        owners: TIKTOK,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.tiktokVideoStatusGet]: readSpec({
        owners: TIKTOK,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
    [TOOL.tiktokCreatorInfoGet]: readSpec({
        owners: TIKTOK,
        account: "any",
        dataKind: "media",
        refusals: PUBLISH_REFUSALS,
    }),
} satisfies ToolSpecRegistry

/** The refusals the SDK types for a core tool that its spec does not list: `never` for every tool, or this file does not compile. */
type Unlisted = {
    readonly [K in CoreToolId]: Exclude<RefusalsOf<K>, (typeof TOOL_SPECS)[K]["refusals"]["codes"][number]>
}[CoreToolId]

/** Compiles only when every code of every SDK union is listed: the SDK never types a refusal the engine does not know. */
export const EVERY_SDK_REFUSAL_LISTED: [Unlisted] extends [never] ? true : never = true

/** True when the SDK marks the tool's signature as one that can ask (`Asking`: `asks: true`). */
type AsksBySdk<K extends CoreToolId> = ToolNames[K] extends { readonly asks: true } ? true : false

/** True when the registry says the tool writes: every such tool can ask a person (a read never asks). */
type AsksBySpec<K extends CoreToolId> = (typeof TOOL_SPECS)[K]["mutates"] extends false ? false : true

/** The core tools whose SDK `asks` mark differs from whether they write: `never`, or this file does not compile. */
type AskMismatch = {
    readonly [K in CoreToolId]: [AsksBySdk<K>] extends [AsksBySpec<K>]
        ? [AsksBySpec<K>] extends [AsksBySdk<K>]
            ? never
            : K
        : K
}[CoreToolId]

/**
 * Compiles only when the SDK's `asks` mark holds exactly for the tools that write (asks <=> mutates): so the typed refusal of
 * `ctx.tools.call` offers `declined` for every tool that can ask and for no read.
 */
export const ASKS_EXACTLY_WHEN_NOT_READ: [AskMismatch] extends [never] ? true : never = true

const SPEC_BY_ID: ReadonlyMap<string, ToolSpec> = new Map(Object.entries(TOOL_SPECS))

/** Every core tool id the registry holds. */
export const CORE_TOOL_IDS: ReadonlyArray<CoreToolId> = [...new Set(Object.values(TOOL))]

/** The spec of a core tool, or null for an id the registry does not hold (a plugin's tool, an operation of a pinned document). */
export const toolSpecOf = (tool: string): OptionalToolSpec => SPEC_BY_ID.get(tool) ?? null

/** True when a core tool writes (`mutates`), false for a read, null for an id the registry does not hold. */
export const mutatesBySpec = (tool: string): boolean | null => toolSpecOf(tool)?.mutates ?? null

/**
 * The core tools served only where an attached account's PINNED document marks them (`availability: "pinned-mark"`): what readiness
 * asks the agent's OpenAPI accounts about.
 */
export const PINNED_MARK_TOOLS: ReadonlyArray<CoreToolId> = CORE_TOOL_IDS.filter(
    (tool) => SPEC_BY_ID.get(tool)?.availability === "pinned-mark",
)

/** True for a core tool NIVO owns itself (the pseudo-provider `nivo`): it acts on no connected account. */
export const isEngineOwned = (tool: string): boolean => toolSpecOf(tool)?.owners.includes(NIVO_OWNER) === true

/** The provider keys of the CRMs the installed packages declare (`crm.<id>`). */
const INSTALLED_CRM_KEYS: ReadonlyArray<string> = INSTALLED.providers()
    .filter((template) => template.kind === "crm")
    .map((template) => crmProviderKeyOf(template.id))

/**
 * The sources that serve a platform purpose through the OpenAPI adapter slot: none since the owner's decision of 2026-11-13 (a CRM serves its
 * own generated operations only, never a platform purpose by a mark), so a purpose with the slot (`nivo.tool.invoice.create`) stays
 * unavailable until a provider adapter serves it.
 */
export const openApiSourcesOfPurpose = (_tool: string): ReadonlyArray<string> => []

/**
 * The owners of a tool: a core tool's spec, else for a CRM operation (`nivo.api.crm.<crmId>.…`) the CRM's provider key (`crm.<crmId>`),
 * else none (a plugin's tool no registry holds).
 */
export const ownersOfTool = (tool: string): ReadonlyArray<string> => {
    const held = toolSpecOf(tool)
    if (held !== null) {
        return held.owners.includes(CRM)
            ? held.owners.flatMap((owner) => (owner === CRM ? INSTALLED_CRM_KEYS : [owner]))
            : held.owners
    }
    const crmId = crmIdOfOp(tool)
    return crmId === null ? [] : [crmProviderKeyOf(crmId)]
}

/** True when the provider (or `nivo`) owns the tool's purpose: what the save check of a template node's account reads. */
export const ownsTool = (owner: string, tool: string): boolean => ownersOfTool(tool).includes(owner)

/** True for a core tool a call is handed ONE account for (the node's list in order, or the default account): C4.3. */
export const takesOneAccountBySpec = (held: ToolSpec): boolean => held.account === "any"
