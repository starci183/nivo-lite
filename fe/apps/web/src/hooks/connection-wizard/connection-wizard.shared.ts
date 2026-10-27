import { purposeFor } from "@/hooks/connection-access"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { guideKey, placeholdersOf, tokenValue, VERIFY, verifyKey } from "@/hooks/connection-guides"
import type { GuideContext, GuideStepDef, Token } from "@/hooks/connection-guides"
import type {
    AgentChoice,
    AgentOption,
    DataSlot,
    Environment,
    GuideField,
    GuideScreen,
    Provider,
    VerifyHelpView,
    WizardNote,
    WizardResume,
} from "@/modules/types"

/** A catalog reader as the wizards pass it around: a key and the values of its placeholders. */
export type CatalogReader = (key: string, values?: Record<string, string | number>) => string

/** How often the wizards ask whether the first event arrived. */
export const POLL_MS = 3000

/** The context of a guide that has no connection yet. */
export const EMPTY_GUIDE_CONTEXT: GuideContext = { name: "", webhookUrl: "", apiKey: "", bank: "", account: "" }

/** Everything the guide lines need to be drawn for one provider. */
export interface GuideBuild {
    readonly provider: Provider
    readonly steps: ReadonlyArray<GuideStepDef>
    readonly ctx: GuideContext
    readonly brand: string
    /** Values the owner pastes from the provider, by field. */
    readonly values: Readonly<Record<string, string>>
    /** Values NIVO owns that the owner may change here, by token; a token present here is editable. */
    readonly drafts: Readonly<Partial<Record<Token, string>>>
}

/** The id fragment of a guide screen. */
const slug = (id: string): string =>
    id
        .normalize("NFD")
        .replace(/[^A-Za-z0-9]+/gu, "-")
        .toLowerCase()

/**
 * The provider's own screens as the wizard draws them: each line is read from the catalog (`t`, namespace connections: the label and
 * option exactly as the provider prints them, the explanation translated) and the wizard's own hints from `tw` (namespace connectionWizard).
 */
export const guideScreensOf = (build: GuideBuild, t: CatalogReader, tw: CatalogReader): ReadonlyArray<GuideScreen> =>
    build.steps.map((step) => ({
        id: slug(step.id),
        heading: tw("onScreen", { brand: build.brand, title: t(guideKey(build.provider, step.id, null, "title")) }),
        fields: step.items.map((item, index): GuideField => {
            const id = `${slug(step.id)}-${index}`
            const part = (name: "label" | "option" | "hint" | "text"): string =>
                t(guideKey(build.provider, step.id, index, name), placeholdersOf(build.ctx))
            if (item.kind === "copy") {
                const draft = build.drafts[item.token]
                return {
                    kind: "copy",
                    id,
                    token: item.token,
                    label: part("label"),
                    isSecret: item.secret,
                    isEditable: draft !== undefined,
                    hint: tw(draft === undefined ? "guideCopyHint" : "guideCopyEdit", { brand: build.brand }),
                    value: draft ?? tokenValue(item.token, build.ctx),
                }
            }
            if (item.kind === "paste") {
                return {
                    kind: "paste",
                    id,
                    field: item.field,
                    label: part("label"),
                    isSecret: item.secret,
                    hint: item.hasHint ? part("hint") : undefined,
                    value: build.values[item.field] ?? "",
                }
            }
            if (item.kind === "choose") {
                return {
                    kind: "choose",
                    id,
                    label: part("label"),
                    option: part("option"),
                    hint: tw("guideChooseHint", { brand: build.brand }),
                }
            }
            if (item.kind === "switch")
                return { kind: "switch", id, label: part("label"), hint: tw("guideSwitchHint", { brand: build.brand }) }
            return { kind: "note", id, text: part("text") }
        }),
    }))

/** What the owner does while the first event is awaited, for this provider and environment; undefined when the provider has no help. */
export const verifyHelpOf = (
    provider: Provider,
    environment: Environment,
    ctx: GuideContext,
    t: CatalogReader,
): VerifyHelpView | undefined => {
    const def = VERIFY[provider]?.[environment]
    if (def === undefined) return undefined
    return {
        intro: t(verifyKey(provider, environment, null)),
        steps: Array.from({ length: def.steps }, (_, index) =>
            t(verifyKey(provider, environment, index), placeholdersOf(ctx)),
        ),
    }
}

/** The catalog key of what an agent does through a connection. */
const PURPOSE_KEYS: Readonly<Record<string, string>> = {
    inbound_chat: "purpose_inbound_chat",
    outbound_chat: "purpose_outbound_chat",
    bank_feed: "purpose_bank_feed",
    lead_source: "purpose_lead_source",
}

/** The agents the last step offers, each with what it does through this provider (listens, sends, reads transactions or takes leads). */
export const agentChoicesOf = (
    agents: ReadonlyArray<AgentOption>,
    provider: Provider,
    tw: CatalogReader,
): ReadonlyArray<AgentChoice> =>
    agents.map((agent) => {
        const purpose = purposeFor(agent.module, provider)
        const key = purpose === null ? undefined : PURPOSE_KEYS[purpose]
        return { id: agent.id, name: agent.name, description: key === undefined ? undefined : tw(key) }
    })

/** The ids of every agent, the default ticks of a new connection. */
export const allAgentIds = (agents: ReadonlyArray<AgentOption>): ReadonlyArray<string> =>
    agents.map((agent) => agent.id)

/** The note a wizard shows: its own, else the failure of reading the stored connection it resumes. */
export const resumeNoteOf = (note: WizardNote | null, resumeError: unknown): WizardNote | null => {
    if (note !== null) return note
    return resumeError instanceof Error ? { tone: "negative", text: resumeError.message } : null
}

/** The read of the stored connection a wizard resumes, as SWR gives it. */
type ResumeRead = {
    readonly data: unknown
    readonly error: unknown
    readonly isLoading: boolean
}

/** The slot of a wizard whose saved connection is a plain read: ready at once for a new one, loading while the stored one is on its way. */
export const resumeSlotOfLoading = (isLoading: boolean, failure: string | null = null): DataSlot<WizardResume> => {
    if (isLoading) return { isLoading: true }
    return failure === null ? { items: { isResumed: true } } : { isError: true }
}

/** The slot of a wizard's resume read: a new connection resumes nothing, so it is ready at once; a resumed one waits for its read. */
export const resumeSlotOf = (resumeId: string | undefined, read: ResumeRead): DataSlot<WizardResume> => {
    if (resumeId === undefined) return { items: { isResumed: false } }
    return mapSlot(slotOfSwr(read), () => ({ isResumed: true }))
}
