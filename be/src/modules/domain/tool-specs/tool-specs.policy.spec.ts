import { TOOL } from "@nivo-lite/agent-sdk/names"
import { mock } from "@starci/jest-preset"
import { SEND_REFUSAL } from "@modules/domain/chat-node-ports/chat-node-ports.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    EINVOICE_MANIFEST,
    NIVO_TOOL_PREFIX,
    SEPAY_MANIFEST,
    effectManifestsOf,
    toolNameOf,
} from "@modules/domain/tools"
import type { RightVerdict, ToolManifest } from "@modules/domain/tools"
import type { PinRefusal } from "@modules/domain/tools/adapters/effect-pin.policy"
import { PROVIDER_CATALOGUE, isChannelBound } from "@modules/domain/tools/provider-abilities.policy"
import { BANK_MANIFEST } from "@modules/domain/native-tools/bank-native.service"
import { BRAIN_MANIFEST } from "@modules/domain/native-tools/brain-native.service"
import { CONNECTION_MANIFEST } from "@modules/domain/native-tools/connection-status-native.service"
import { CONTACT_TOOLS_MANIFEST } from "@modules/domain/contact-tools"
import { DRIVE_MANIFEST } from "@modules/domain/native-tools/drive-native.service"
import { RECORD_MANIFEST } from "@modules/domain/native-tools/record-native.service"
import { RECORD_REFUSAL_CLASS } from "@modules/domain/native-tools/record-native.policy"
import { FILE_MANIFEST } from "@modules/domain/native-tools/file-native.service"
import { FILE_REFUSAL_CLASS } from "@modules/domain/native-tools/file-native.policy"
import { CALENDAR_REFUSAL_CLASS } from "@modules/domain/calendar-tools"
import { SOCIAL_REFUSAL_CLASS } from "@modules/domain/social-tools"
import { DOMAIN_REFUSAL_CLASS } from "@modules/domain/domain-tools"
import { INVOICE_MANIFEST } from "@modules/domain/invoice-tools"
import { INVOICE_REFUSAL_CLASS } from "@modules/domain/invoice-tools/invoice-refusal.policy"
import { CALENDAR_MANIFEST } from "@modules/domain/calendar-tools"
import { FACEBOOK_MANIFEST, INSTAGRAM_MANIFEST, TIKTOK_MANIFEST, YOUTUBE_MANIFEST } from "@modules/domain/social-tools"
import { MEDIA_REFUSAL_CLASS } from "@modules/domain/media-tools"
import { DOMAIN_MANIFEST } from "@modules/domain/domain-tools/domain-tools.service"
import { MEDIA_MANIFEST } from "@modules/domain/media-tools"
import { LEDGER_MANIFEST } from "@modules/domain/native-tools/ledger-native.service"
import { MAIL_MANIFEST } from "@modules/domain/native-tools/mail-native.service"
import { MAIL_SEND_MANIFEST } from "@modules/domain/native-tools/mail-send-native.service"
import { NATIVE_REFUSAL_CLASS } from "@modules/domain/native-tools/native-refusal.policy"
import { NIVO_CONTEXT_CONNECTOR } from "@modules/domain/native-tools/nivo-native.service"
import { PASSAGE_MANIFEST } from "@modules/domain/native-tools/passage-native.service"
import { pluginToolManifestsOf } from "@modules/domain/native-tools/plugin-tools-native.service"
import { OPENAPI_PROVIDER, OPENAPI_SOURCE_KEYS, installedDeclarationsOf } from "@modules/domain/openapi-tools"
import { TeamChatNativeService } from "@modules/domain/team-chat"
import {
    ASKS_EXACTLY_WHEN_NOT_READ,
    CANCEL_RULE_REFUSALS,
    CORE_TOOL_IDS,
    EVERY_SDK_REFUSAL_LISTED,
    FROZEN_RIGHT_REFUSALS,
    HELD_RIGHT_REFUSALS,
    NIVO_OWNER,
    PIN_REFUSALS,
    SEND_REFUSALS,
    TOOL_SPECS,
    isEngineOwned,
    mutatesBySpec,
    ownersOfTool,
    ownsTool,
    repeatableBySpec,
    toolSpecOf,
} from "./tool-specs.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"
import type { CoreToolId, ToolSpec } from "./tool-specs.contracts"

/** True when two unions hold the same members. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/** Compiles only for `true`. */
const typed = (proof: true): boolean => proof

/** The refusal reasons of the attachments' verdict. */
type AbilityRefusal = Extract<RightVerdict, { readonly kind: "refuse" }>["reason"]

/**
 * Why an order may not be cancelled: the five names of the sales rule's `CancelRefusal`, which blocks-core pins to exactly these in
 * `rules/sales/order-status.spec.ts` (the engine names no rule of a plugin).
 */
type CancelRule = "order_not_cancellable" | "order_paid" | "order_invoiced" | "order_has_payment" | "order_has_invoice"

const specOf = (tool: CoreToolId): ToolSpec => {
    const held = toolSpecOf(tool)
    if (held === null)
        throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `no spec for ${tool}` } })
    return held
}

/**
 * The provider keys whose ability holds the tool, a source's OpenAPI ability named by the source whose declarations hold it (never
 * `openapi`): its own namespace's tools, and the platform purposes the registry's OpenAPI slot serves on it.
 */
const holdersOf = (tool: string): ReadonlyArray<string> => [
    ...new Set(
        PROVIDER_CATALOGUE.flatMap((spec) =>
            spec.abilities
                .filter((ability) => ability.tools.includes(tool))
                .map((ability) =>
                    spec.provider === OPENAPI_PROVIDER
                        ? (OPENAPI_SOURCE_KEYS.find((key) =>
                              installedDeclarationsOf(key).some((declaration) => declaration.tool === ability.id),
                          ) ?? spec.provider)
                        : spec.provider,
                ),
        ),
    ),
]

/** The abilities of the catalogue that hold the tool. */
const abilitiesOf = (tool: string): ReadonlyArray<{ readonly scope: string; readonly account?: string }> =>
    PROVIDER_CATALOGUE.flatMap((spec) => spec.abilities.filter((ability) => ability.tools.includes(tool)))

/** The natives every app hands the gateway, with the api app's chat and team chat (as `native-names.spec.ts` lists them). */
const nativeManifests = (): ReadonlyArray<ToolManifest> => [
    SEPAY_MANIFEST,
    EINVOICE_MANIFEST,
    BRAIN_MANIFEST,
    PASSAGE_MANIFEST,
    DRIVE_MANIFEST,
    CONNECTION_MANIFEST,
    BANK_MANIFEST,
    LEDGER_MANIFEST,
    MAIL_MANIFEST,
    MAIL_SEND_MANIFEST,
    CONTACT_TOOLS_MANIFEST,
    DOMAIN_MANIFEST,
    INVOICE_MANIFEST,
    MEDIA_MANIFEST,
    RECORD_MANIFEST,
    FILE_MANIFEST,
    CALENDAR_MANIFEST,
    FACEBOOK_MANIFEST,
    INSTAGRAM_MANIFEST,
    YOUTUBE_MANIFEST,
    TIKTOK_MANIFEST,
    {
        key: NIVO_CONTEXT_CONNECTOR,
        namespace: NIVO_TOOL_PREFIX,
        name: "NIVO",
        contractVersion: "nivo-native@1",
        tools: [...pluginToolManifestsOf(INSTALLED)],
    },
    new TeamChatNativeService(
        mock<ConstructorParameters<typeof TeamChatNativeService>[0]>(),
        mock<ConstructorParameters<typeof TeamChatNativeService>[1]>(),
    ).manifest,
]

/** The ids NIVO's installed effects run under (the effect road: pin and rights refusals apply). */
const EFFECT_IDS: ReadonlySet<string> = new Set(
    effectManifestsOf(INSTALLED.nodeInstall().effects).flatMap((manifest) =>
        manifest.tools.map((tool) => toolNameOf(manifest, tool.name)),
    ),
)

/**
 * The provider purposes whose account mode is their own, stated when their providers were registered (2026-11-13), not the former
 * catalogue rule (a read covers `each` account, a write takes `any`): a call about a domain the workspace HOLDS acts on the account
 * that holds it (`owner`, the domain tools find it by the domain); a call about a name not held yet, a page of one account, and every
 * media call take ONE bound account (`any`), a read included (it asks one provider account, it merges none).
 */
const OWN_ACCOUNT: Readonly<Partial<Record<CoreToolId, string>>> = {
    [TOOL.domainAvailabilityGet]: "any",
    [TOOL.domainGet]: "owner",
    [TOOL.domainList]: "any",
    [TOOL.domainRegistrationCreate]: "any",
    [TOOL.domainRenewalCreate]: "owner",
    [TOOL.domainRenewalGet]: "owner",
    [TOOL.domainTransferCreate]: "any",
    [TOOL.domainDnsRecordList]: "owner",
    [TOOL.domainDnsRecordCreate]: "owner",
    [TOOL.domainDnsRecordUpdate]: "owner",
    [TOOL.domainDnsRecordDelete]: "owner",
    [TOOL.domainNameserverUpdate]: "owner",
    [TOOL.speechGenerate]: "any",
    [TOOL.speechVoiceList]: "any",
    [TOOL.dubbingCreate]: "any",
    [TOOL.dubbingGet]: "any",
    [TOOL.videoGenerate]: "any",
    [TOOL.videoGenerationGet]: "any",
    // A render's status at the compose account the node's order picks, as a Veo generation's.
    [TOOL.videoRenderGet]: "any",
    // The generic transfer instruction: ONE bound bank account (`any`), a read by what its adapters do.
    [TOOL.paymentTransferCreate]: "any",
    // One bank move of ONE bound bank account (`any`; a read that asks one account, it merges none).
    [TOOL.paymentCreditGet]: "any",
    // The payment link read: ONE bound payOS account (`any`; a read that asks one account, it merges none).
    [TOOL.paymentLinkGet]: "any",
    // The calendar and the destinations: a read asks ONE bound account of its owner provider (it merges none), as every media call does.
    [TOOL.calendarSlotFreeList]: "any",
    [TOOL.instagramMediaStatusGet]: "any",
    [TOOL.youtubeVideoStatusGet]: "any",
    [TOOL.tiktokVideoStatusGet]: "any",
    [TOOL.tiktokCreatorInfoGet]: "any",
}

describe("the engine's tool specs: one total record, agreeing tool by tool with the tables it replaces", () => {
    it("holds one spec per core tool id and no other", () => {
        expect(Object.keys(TOOL_SPECS).sort()).toEqual([...new Set<string>(Object.values(TOOL))].sort())
        expect(CORE_TOOL_IDS.filter((tool) => toolSpecOf(tool) === null)).toEqual([])
        expect(toolSpecOf("nivo.api.crm.nivoweb.get.prices")).toBeNull()
        expect(toolSpecOf("toString")).toBeNull()
    })

    it.each(CORE_TOOL_IDS)("%s: whether it writes is what mutatesBySpec answers", (tool) => {
        expect(mutatesBySpec(tool)).toBe(specOf(tool).mutates)
    })

    it("answers null for whether an id no registry holds writes", () => {
        expect(mutatesBySpec("nivo.tool.nothing.here")).toBeNull()
    })

    it.each(CORE_TOOL_IDS)(
        "%s: its owners are the catalogue's holders, else NIVO alone",
        (tool) => {
            const holders = holdersOf(tool)
            const owners = specOf(tool).owners

            expect([...owners].sort()).toEqual(holders.length === 0 ? [NIVO_OWNER] : [...holders].sort())
            expect(isEngineOwned(tool)).toBe(holders.length === 0)
            expect(ownersOfTool(tool)).toBe(owners)
        },
    )

    it.each(CORE_TOOL_IDS)(
        "%s: its account mode is what the catalogue's abilities say",
        (tool) => {
            const held = specOf(tool)
            const abilities = abilitiesOf(tool)
            const expected =
                OWN_ACCOUNT[tool] ??
                (abilities.length === 0 ? "none" : isChannelBound(tool) ? "owner" : !held.mutates ? "each" : "any")

            expect(held.account).toBe(expected)
            // A read ability holds only reads; a write ability only writes.
            for (const ability of abilities) expect(ability.scope === "read").toBe(!held.mutates)
        },
    )

    it("agrees with every native manifest's scope, and every installed effect is a write", () => {
        const natives = nativeManifests().flatMap((manifest) =>
            manifest.tools.map((tool) => ({ id: toolNameOf(manifest, tool.name), scope: tool.scope })),
        )
        const disagreeing = natives.filter((native) => {
            const held = toolSpecOf(native.id)
            if (held === null) return false
            return (native.scope === "read") !== !held.mutates
        })

        expect(disagreeing).toEqual([])
        expect(natives.filter((native) => toolSpecOf(native.id) === null).map((native) => native.id)).toEqual([])
        expect([...EFFECT_IDS].filter((id) => toolSpecOf(id)?.mutates === false)).toEqual([])
    })

    it("marks a signature `asks` exactly for the tools that write (compile-time; the constant is the proof)", () => {
        expect(ASKS_EXACTLY_WHEN_NOT_READ).toBe(true)
        const reads = CORE_TOOL_IDS.filter((id) => toolSpecOf(id)?.mutates === false)
        expect(reads).toContain(TOOL.contactGet)
        expect(reads).not.toContain(TOOL.mailMessageSend)
    })

    it("serves the e-invoice issue as a PROVIDER tool of the e-invoice providers on one bound account, never a CRM's (owner ruling R57)", () => {
        // Ledger: before R57 its owner was the CRM slot (`crm`, `pinned-mark`, unavailable while no pin marked it); the owner ruled that
        // NIVO keeps no invoice tool of its own and the invoice is issued AT the provider. The id stays (the SDK's one id per purpose).
        expect(specOf(TOOL.invoiceCreate)).toMatchObject({ mutates: true, owners: ["misa_meinvoice"], account: "any", repeatable: false })
        expect(specOf(TOOL.invoiceCreate).refusals.codes).toEqual(["rejected", "not_found"])
        expect(ownersOfTool(TOOL.invoiceCreate)).toEqual(["misa_meinvoice"])
        expect(ownsTool("crm.nivoweb", TOOL.invoiceCreate)).toBe(false)
    })

    it("serves the renewal check as a read of the registrars on the account that holds the domain", () => {
        expect(specOf(TOOL.domainRenewalGet)).toMatchObject({ mutates: false, owners: ["inet", "tino"], account: "owner", repeatable: true })
    })

    it("declares every tool's repeatability (R74): every read repeatable, of the writes only the customer send", () => {
        expect(CORE_TOOL_IDS.filter((tool) => !specOf(tool).mutates && !specOf(tool).repeatable)).toEqual([])
        expect(CORE_TOOL_IDS.filter((tool) => specOf(tool).mutates && specOf(tool).repeatable)).toEqual([TOOL.customerMessageSend])
        expect(repeatableBySpec(TOOL.domainRenewalCreate)).toBe(false)
        expect(repeatableBySpec(TOOL.invoiceCreate)).toBe(false)
        expect(repeatableBySpec(TOOL.customerMessageSend)).toBe(true)
        expect(repeatableBySpec(TOOL.domainGet)).toBe(true)
        expect(repeatableBySpec("nivo.api.crm.nivoweb.get.prices")).toBeNull()
    })

    it("owns a CRM's generated operation by the CRM's provider key (`crm.<id>`), never by `openapi` or another CRM", () => {
        const [source] = OPENAPI_SOURCE_KEYS
        expect(source).toBe("crm.nivoweb")
        const prices = "nivo.api.crm.nivoweb.get.prices"
        expect(ownersOfTool(prices)).toEqual(["crm.nivoweb"])
        expect(ownsTool("crm.nivoweb", prices)).toBe(true)
        expect(ownsTool(OPENAPI_PROVIDER, prices)).toBe(false)
        expect(ownsTool("crm.other", prices)).toBe(false)
        expect(ownsTool("nivo", prices)).toBe(false)
        // A shop's own CRM, whose id no package declares, owns its operations the same way.
        expect(ownersOfTool("nivo.api.crm.shopcrm.post.orders.code.status")).toEqual(["crm.shopcrm"])
        expect(ownersOfTool("nivo.tool.nothing.here")).toEqual([])
        expect(ownersOfTool("nivo.api.openapi.info")).toEqual([])
    })
})

describe("the refusals of each tool, per adapter family", () => {
    it("types every SDK refusal union exactly as the registry lists it (compile-time; the constant is the proof)", () => {
        expect(EVERY_SDK_REFUSAL_LISTED).toBe(true)
    })

    it("the engine's own refusal families are the typed ones they name", () => {
        expect(typed(true satisfies Same<PinRefusal, (typeof PIN_REFUSALS)[number]>)).toBe(true)
        expect(typed(true satisfies Same<AbilityRefusal, (typeof HELD_RIGHT_REFUSALS)[number]>)).toBe(true)
        expect(typed(true satisfies Same<CancelRule, (typeof CANCEL_RULE_REFUSALS)[number]>)).toBe(true)
        expect([...SEND_REFUSALS].sort()).toEqual(Object.values(SEND_REFUSAL).sort())
    })

    it("lists, for every effect, the pin's refusals", () => {
        const missing = [...EFFECT_IDS].flatMap((id) => {
            const held = toolSpecOf(id)
            if (held === null) return [`${id}: no spec`]
            const wanted: ReadonlyArray<string> = [...PIN_REFUSALS]
            return wanted.filter((code) => !held.refusals.codes.includes(code)).map((code) => `${id}: ${code}`)
        })

        expect(missing).toEqual([])
    })

    it("lists no refusal of a right in any tool's set: the template road freezes on each (ADDENDUM 4.3)", () => {
        expect(FROZEN_RIGHT_REFUSALS).toEqual([...HELD_RIGHT_REFUSALS])
        const listed = CORE_TOOL_IDS.flatMap((id) =>
            specOf(id)
                .refusals.codes.filter((code) => FROZEN_RIGHT_REFUSALS.some((frozen) => frozen === code))
                .map((code) => `${id}: ${code}`),
        )

        expect(listed).toEqual([])
    })

    it("lists every code the typed unions of the executors hand on", () => {
        expect(SEND_REFUSALS.filter((code) => !specOf(TOOL.customerMessageSend).refusals.codes.includes(code))).toEqual(
            [],
        )
    })

    it("names only native refusal reasons their source classes BUSINESS for the natives' sets (the others freeze)", () => {
        // Each family of natives classes its own refusals: the generic natives, the domain tools, the media tools, the record tools
        // and the file tools.
        const natives = [
            NATIVE_REFUSAL_CLASS,
            DOMAIN_REFUSAL_CLASS,
            INVOICE_REFUSAL_CLASS,
            MEDIA_REFUSAL_CLASS,
            RECORD_REFUSAL_CLASS,
            FILE_REFUSAL_CLASS,
            CALENDAR_REFUSAL_CLASS,
            SOCIAL_REFUSAL_CLASS,
        ].flatMap((classes) =>
            Object.entries(classes).flatMap(([reason, kind]): ReadonlyArray<string> =>
                kind === "business" ? [reason] : [],
            ),
        )
        const nativeIds = new Set(
            nativeManifests().flatMap((manifest) => manifest.tools.map((tool) => toolNameOf(manifest, tool.name))),
        )
        const unknown = CORE_TOOL_IDS.filter((tool) => nativeIds.has(tool) && !EFFECT_IDS.has(tool)).flatMap((tool) =>
            specOf(tool).refusals.codes.filter((code) => !natives.some((reason) => reason === code)),
        )

        expect(unknown).toEqual([])
        // A native's business refusal is answered to the node (`businessRefusalOf`); a native claims a CLOSED set only where its
        // adapter classes every refusal it can answer: the record tools, the compose and the contact writes (their sets hold business
        // refusals only: `internal_only` and `ask_only` freeze the step and are no answer). Every other native's set stays open.
        expect(CORE_TOOL_IDS.filter((tool) => nativeIds.has(tool) && specOf(tool).refusals.closed).sort()).toEqual(
            [
                TOOL.recordGet,
                TOOL.recordList,
                TOOL.recordCreate,
                TOOL.recordUpdate,
                TOOL.filePut,
                TOOL.fileLink,
                TOOL.fileGet,
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
                TOOL.contactUpdate,
                TOOL.contactMemoryRemember,
                TOOL.contactIdentityLink,
                TOOL.contactMerge,
            ].sort(),
        )
        // Their closed sets are exactly the business refusals of their family that their verb can answer.
        const recordBusiness = Object.entries(RECORD_REFUSAL_CLASS).flatMap(([reason, kind]) =>
            kind === "business" ? [reason] : [],
        )
        for (const tool of [TOOL.recordGet, TOOL.recordList, TOOL.recordCreate, TOOL.recordUpdate]) {
            expect(specOf(tool).refusals.codes.filter((code) => !recordBusiness.includes(code))).toEqual([])
        }
        // The contact writes: every code of their closed sets is a business refusal of the generic natives (`internal_only` is not one).
        const genericBusiness = Object.entries(NATIVE_REFUSAL_CLASS).flatMap(([reason, kind]) =>
            kind === "business" ? [reason] : [],
        )
        for (const tool of [
            TOOL.contactUpdate,
            TOOL.contactMemoryRemember,
            TOOL.contactIdentityLink,
            TOOL.contactMerge,
        ]) {
            expect(specOf(tool).refusals.codes.filter((code) => !genericBusiness.includes(code))).toEqual([])
        }
        expect(specOf(TOOL.contactIdentityLink).refusals.codes).not.toContain("internal_only")
    })
})
