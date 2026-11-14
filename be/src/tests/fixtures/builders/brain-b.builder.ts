import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { NO_INSTALLATION, type CandidatePage, type TruthKey } from "@modules/domain/brain/brain-policy-candidates.service"
import type { JudgedFact } from "@modules/domain/brain/brain-policy-store.service"
import { basisOf, groupKeyOf, groupsInUse, valueTypeOf, type DerivedPolicy, type DeriveRebind } from "@modules/domain/brain/policy-derive.policy"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { DIA_CHI_VI, GIAO_HANG_NOI_THANH_VI, GIAO_HANG_VI, GIAO_HOA_TOC_SAU_18_00_VI, GIO_LAM_VIEC_VI, GIO_MO_CUA_VI, GIU_CHO_VI, KHONG_PHAI_QUY_DINH_VI, KHUNG_GIO_PHUC_VU_VI, LOP_YOGA_VI, MUC_PHI_CHU_TIEM_CHINH_DUOC_VI, PHI_GIAO_HANG_NOI_THANH_VI, PHI_GIAO_HANG_VI, PHI_SHIP_NOI_THANH_VI, PHI_SHIP_VI, PHU_PHI_15_000_D_VI, QUY_DINH_TIEM_HOA_VI, THONG_TIN_LIEN_HE_CUA_TIEM_VI, V_15_PHUT_VI, V_20_000_D_MOT_DON_VI, V_30_000_D_MOT_DON_VI, V_50_000_D_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"

/** A complete fact row of the delivery fee, ready for overrides. */
export const factOf: (changes?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "fee",
    subjectType: "service",
    subjectKey: "giao-hang-noi-thanh",
    subjectLabel: GIAO_HANG_NOI_THANH_VI,
    attribute: "phi-giao-hang",
    attributeLabel: PHI_GIAO_HANG_VI,
    value: V_30_000_D_MOT_DON_VI,
    valueNumber: 30000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "document",
    trust: 75,
    validFrom: "2026-11-10T00:00:00.000Z",
    validTo: "2027-11-10T00:00:00.000Z",
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [
        {
            kind: "document",
            ref: "doc-1",
            label: QUY_DINH_TIEM_HOA_VI,
            title: QUY_DINH_TIEM_HOA_VI,
            sourceId: "doc-1",
            at: "2026-11-10T00:00:00.000Z",
        },
    ],
    proposedBy: "NIVO",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
})

/** The fee fact in force: version 2 of the delivery fee. */
export const FEE: FactRecord = factOf({ version: 2 })

/** The delivery fee fact the current one superseded. */
export const OLD_FEE: FactRecord = factOf({ id: "fee-v1", status: "superseded", value: V_20_000_D_MOT_DON_VI, version: 1 })

/** A product fact: not a policy under the subject-type rule. */
export const PRODUCT: FactRecord = factOf({
    id: "rose",
    subjectType: "product",
    subjectKey: "hoa-hong",
    attribute: "gia",
    value: V_50_000_D_VI,
})

/** A proposal waiting for a policy that has no value in force. */
export const UNSET_PROPOSAL: FactRecord = factOf({
    id: "p-express",
    status: "proposed",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: GIAO_HANG_VI,
    attribute: "giao-hoa-toc-sau-18-00",
    attributeLabel: GIAO_HOA_TOC_SAU_18_00_VI,
    value: PHU_PHI_15_000_D_VI,
    proposedBy: "sales",
    proposedAt: "2026-11-11T09:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    evidence: [{ kind: "decision", ref: "agent.run-stop:s1", label: "Ada", at: "2026-11-09T00:00:00.000Z" }],
})

/** A gym's rule read from a document: it waits (asked or not), nothing is in force for its key. */
export const WAITING_RULE: FactRecord = factOf({
    id: "w-hold",
    status: "proposed",
    subjectType: "other",
    subjectKey: "lop-yoga",
    subjectLabel: LOP_YOGA_VI,
    attribute: "giu-cho",
    attributeLabel: GIU_CHO_VI,
    value: V_15_PHUT_VI,
    decidedBy: null,
    decidedAt: null,
})

/** The judgements kept in memory, written the way the real store writes them. */
export class MemoryStore {
    /** The judgements kept. */
    rows: Array<DerivedPolicy>
    /** How many writes were made. */
    writes = 0

    constructor(rows: ReadonlyArray<DerivedPolicy> = []) {
        this.rows = [...rows]
    }

    /** Every judgement kept. */
    all(): Promise<ReadonlyArray<DerivedPolicy>> {
        return Promise.resolve([...this.rows])
    }

    /** Writes the judgements the way the real store does. */
    save(_workspaceId: string, judged: ReadonlyArray<JudgedFact>): Promise<number> {
        judged.forEach(({ fact, known, judgement }) => {
            this.writes += 1
            const row: DerivedPolicy = {
                id: known?.id ?? `p-${fact.id}`,
                subjectKey: fact.subjectKey,
                attribute: fact.attribute,
                installationId: fact.installationId,
                factId: fact.id,
                factVersion: fact.version ?? null,
                basis: basisOf(fact),
                kind: judgement.policy ? "policy" : "not_policy",
                title: judgement.title,
                groupKey: groupKeyOf(judgement.group),
                groupLabel: judgement.group,
                valueType: valueTypeOf(fact),
                reason: judgement.reason,
                status: "open",
            }
            this.rows = [...this.rows.filter((one) => one.id !== row.id), row]
        })
        return Promise.resolve(judged.length)
    }

    /** Moves judgements onto the next version of their fact. */
    rebind(_workspaceId: string, moves: ReadonlyArray<DeriveRebind>): Promise<void> {
        moves.forEach((move) => {
            this.writes += 1
            this.rows = this.rows.map((row) =>
                row.id === move.id
                    ? { ...row, factId: move.factId, factVersion: move.factVersion, valueType: move.valueType, status: "open" }
                    : row,
            )
        })
        return Promise.resolve()
    }

    /** Retires the judgements with the given ids. */
    retire(_workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        ids.forEach(() => (this.writes += 1))
        this.rows = this.rows.map((row) => (ids.includes(row.id) ? { ...row, status: "retired" } : row))
        return Promise.resolve()
    }

    /** The judgement bound to a fact. */
    of(factId: string): DerivedPolicy | undefined {
        return this.rows.find((row) => row.factId === factId)
    }

    /** The judgements of the given truth keys. */
    ofTruths(_workspaceId: string, keys: ReadonlyArray<TruthKey>): Promise<ReadonlyArray<DerivedPolicy>> {
        const wanted = new Set(keys.map((key) => keyText(key)))
        return Promise.resolve(this.rows.filter((row) => wanted.has(keyText(truthOf(row)))))
    }

    /** The groups in use, at most `limit`. */
    groupsInUse(_workspaceId: string, limit: number): Promise<ReadonlyArray<string>> {
        return Promise.resolve(groupsInUse(this.rows).slice(0, limit))
    }

    /** Whether any judgement is kept. */
    hasAny(): Promise<boolean> {
        return Promise.resolve(this.rows.length > 0)
    }

    /** The SQL of `orphaned`, in memory: open judgements no held fact holds. */
    orphaned(_workspaceId: string, limit: number): Promise<ReadonlyArray<string>> {
        const heldKeys = new Set(this.facts().filter((fact) => isHeld(fact)).map((fact) => keyText(truthOf(fact))))
        return Promise.resolve(
            this.rows
                .filter((row) => row.status === "open" && !heldKeys.has(keyText(truthOf(row))))
                .map((row) => row.id)
                .slice(0, limit),
        )
    }

    /** The facts in force, set by the spec. */
    facts: () => ReadonlyArray<FactRecord> = () => []
}

/** The truth key of a fact or a judgement, as the SQL makes it. */
const truthOf = (one: Pick<FactRecord, "subjectKey" | "attribute" | "installationId">): TruthKey => ({
    subjectKey: one.subjectKey,
    attribute: one.attribute,
    installation: one.installationId ?? NO_INSTALLATION,
})
const keyText = (key: TruthKey): string => `${key.subjectKey}\u0000${key.attribute}\u0000${key.installation}`
const compareText = (a: string, b: string): number => {
    if (a < b) return -1
    return a > b ? 1 : 0
}
const isHeld = (fact: FactRecord): boolean =>
    (fact.status === "active" || fact.status === "scheduled") &&
    fact.proposalKind === "set" &&
    fact.subjectType !== "customer" &&
    fact.subjectType !== "person"

/**
 * The SQL of `BrainPolicyCandidatesService`, in memory and counted: the truths with no open judgement bound to a fact that holds them,
 * in key order after the cursor. Every call is one statement of the real service.
 */
export class MemoryCandidates {
    /** How many pages were read. */
    pages = 0
    /** How many counts were read. */
    counts = 0

    constructor(
        private readonly facts: () => ReadonlyArray<FactRecord>,
        private readonly store: MemoryStore,
    ) {}

    private unsettled(): ReadonlyArray<TruthKey> {
        const held = this.facts().filter((fact) => isHeld(fact))
        const byId = new Map(held.map((fact) => [fact.id, fact]))
        const settled = new Set(
            this.store.rows
                .filter((row) => row.status === "open" && byId.has(row.factId) && (byId.get(row.factId)?.version ?? null) === row.factVersion)
                .map((row) => keyText(truthOf(row))),
        )
        const keys = new Map(held.map((fact) => [keyText(truthOf(fact)), truthOf(fact)]))
        return [...keys.entries()]
            .filter(([text]) => !settled.has(text))
            .sort(([a], [b]) => compareText(a, b))
            .map(([, key]) => key)
    }

    /** One page of unsettled truths after the cursor. */
    page(_workspaceId: string, after: TruthKey | null, limit: number): Promise<CandidatePage> {
        this.pages += 1
        const from = after === null ? "" : keyText(after)
        const keys = this.unsettled()
            .filter((key) => keyText(key) > from)
            .slice(0, limit)
        const wanted = new Set(keys.map((key) => keyText(key)))
        const factIds = this.facts()
            .filter((fact) => isHeld(fact) && wanted.has(keyText(truthOf(fact))))
            .map((fact) => fact.id)
        return Promise.resolve({ keys, factIds, last: keys.at(-1) ?? null })
    }

    /** How many truths are unsettled. */
    count(): Promise<number> {
        this.counts += 1
        return Promise.resolve(this.unsettled().length)
    }
}

/** One judgement line the scripted model answers for a fact it finds in the prompt. */
export interface Scripted {
    readonly policy: boolean
    readonly title?: string
    readonly group?: string
    readonly reason?: string
}

/** The lines a scripted model says, by attribute label; a label set to undefined is one the model skips. */
export type ScriptOf = Readonly<Record<string, Scripted | undefined>>

/** One chat call as the AI layer takes it. */
type AiChatRequest = Parameters<AiService["chat"]>[0]

/** The model's answer to a prompt: one item per numbered fact line, by the attribute label on the line. */
export const answerOf = (request: AiChatRequest, script: ScriptOf): string => {
    const lines = (request.messages[1]?.content ?? "").split("\n").filter((line) => /^\d+\. /.test(line))
    const items = lines.flatMap((line) => {
        const index = Number(line.slice(0, line.indexOf(".")))
        const label = Object.keys(script).find((name) => line.includes(`| ${name}:`))
        const said = label === undefined ? { policy: false, reason: KHONG_PHAI_QUY_DINH_VI } : script[label]
        return said === undefined
            ? []
            : [{ i: index, policy: said.policy, title: said.title ?? "", group: said.group ?? "", reason: said.reason ?? "" }]
    })
    return `Here it is:\n\`\`\`json\n${JSON.stringify(items)}\n\`\`\``
}

/** The default script: delivery fees and opening hours are policies, the address is not. */
export const SCRIPT: Readonly<Record<string, Scripted>> = {
    [PHI_GIAO_HANG_VI]: { policy: true, title: PHI_GIAO_HANG_NOI_THANH_VI, group: GIAO_HANG_VI, reason: MUC_PHI_CHU_TIEM_CHINH_DUOC_VI },
    [PHI_SHIP_VI]: { policy: true, title: PHI_SHIP_NOI_THANH_VI, group: GIAO_HANG_VI, reason: MUC_PHI_CHU_TIEM_CHINH_DUOC_VI },
    [GIO_MO_CUA_VI]: { policy: true, title: GIO_MO_CUA_VI, group: GIO_LAM_VIEC_VI, reason: KHUNG_GIO_PHUC_VU_VI },
    [DIA_CHI_VI]: { policy: false, reason: THONG_TIN_LIEN_HE_CUA_TIEM_VI },
}

/** A chat answer carrying the given text. */
export const answer = (text: string): AiChatAnswer => ({
    text,
    parsed: null,
    model: "claude-haiku-5-5",
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: null },
    retrieved: 0,
})
