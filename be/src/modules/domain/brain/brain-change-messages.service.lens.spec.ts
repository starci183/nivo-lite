import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { viewOfCall } from "@modules/domain/native-tools/native-view.policy"
import { inForce, visibleTo } from "@modules/domain/brain-facts"
import type { ReasonedChangeRequest } from "@modules/domain/brain-facts"
import { OWNER, buildChangeWorld, requestOf } from "@tests/fixtures/builders/brain.builder"
import type { ChangeWorld } from "@tests/fixtures/builders/brain.builder"
import { ANH_VUA_NHAN_TU_MAI_PHI_2_VI, PHI_GIAO_HANG_VI, QUY_DINH_BAN_HANG_DOCX_VI, QUY_DINH_VI, TU_MAI_PHI_SHIP_NOI_THANH_2_VI, T_35_000_D_MOT_DON_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_FEE_VALUE_VI, DELIVERY_SUBJECT_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

const SALES = "inst-sales"
/** The day the new fee starts (00:00 VN), after the founder's yes. */
const START = "2026-11-11T17:00:00.000Z"
const BEFORE = Date.parse("2026-11-11T12:00:00.000Z")
const AFTER = Date.parse("2026-11-11T18:00:00.000Z")
/** The shop's fee told to customers: kept for every instance, public. */
const PUBLIC_FEE = facts.factOf({
    id: "f-fee",
    subjectKey: "giao-hang-noi-thanh",
    attribute: "phi-giao-hang",
    subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
    attributeLabel: PHI_GIAO_HANG_VI,
    value: DELIVERY_FEE_VALUE_VI,
    status: "active",
    version: 1,
    scope: "public",
    installationId: null,
    evidence: [{ kind: "document", ref: "doc-rules", label: QUY_DINH_VI, title: QUY_DINH_BAN_HANG_DOCX_VI }],
})
const salesRequest = (changes: Partial<ReasonedChangeRequest> = {}): ReasonedChangeRequest =>
    requestOf({
        subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
        attributeLabel: PHI_GIAO_HANG_VI,
        value: T_35_000_D_MOT_DON_VI,
        quote: TU_MAI_PHI_SHIP_NOI_THANH_2_VI,
        reason: ANH_VUA_NHAN_TU_MAI_PHI_2_VI,
        validFrom: START,
        installationId: SALES,
        ...changes,
    })
/** The lens of each agent, as every Brain tool builds it (`viewOfCall`): module audience, conversation, instance. */
const frontDesk = viewOfCall(facts.WS, { module: "chatbot", installationId: "inst-front" }, "conv-customer")
const hiring = viewOfCall(facts.WS, { module: "hiring", installationId: null }, null)
const salesOther = viewOfCall(facts.WS, { module: "sales", installationId: "inst-sales-2" }, null)
/** What an agent reads of the key at an instant: the reading rule of the Brain tools (in force, inside the lens). */
const readsAt = (world: ChangeWorld, view: ReturnType<typeof viewOfCall>, at: number): ReadonlyArray<string> =>
    [...world.byId.values()]
        .filter(
            (fact) =>
                fact.subjectKey === "giao-hang-noi-thanh" &&
                (fact.status === "active" || fact.status === "scheduled") &&
                inForce(fact, at) &&
                visibleTo(fact, view.audience, view.module, view.installationId),
        )
        .map((fact) => fact.value)
/** The founder's approval through the card, then what the store's `schedule` does (FX5, covered in its own specs). */
const approve = async (world: ChangeWorld, changeId: string, replacedId: string | null): Promise<void> => {
    await world.service.decide(OWNER, { workspaceId: facts.WS, changeId, action: "approve" })
    const approved = world.byId.get(changeId)
    if (approved !== undefined) world.byId.set(changeId, { ...approved, status: "scheduled", validFrom: START, supersedesId: replacedId })
    const replaced = replacedId === null ? undefined : world.byId.get(replacedId)
    if (replacedId !== null && replaced !== undefined) world.byId.set(replacedId, { ...replaced, validTo: START })
}

describe("FX6: a truth Sales proposes is the whole shop's; each agent reads it through its own lens", () => {
    it("the Sales chat changes the workspace-wide fee: filed in its scope, card kind change with the value in force shown", async () => {
        const world = await buildChangeWorld()
        world.byId.set(PUBLIC_FEE.id, PUBLIC_FEE)

        const filed = await world.requests.propose(facts.WS, salesRequest())

        expect(world.store.propose.mock.calls[0]?.[1]).toMatchObject({ installationId: null, autoApply: false })
        expect(filed.fact).toMatchObject({ installationId: null, scope: "public", conflictWith: PUBLIC_FEE.id })
        expect(world.payloadOf(filed.fact.id)).toMatchObject({
            kind: "change",
            oldValue: DELIVERY_FEE_VALUE_VI,
            current: { value: DELIVERY_FEE_VALUE_VI, version: 1, source: QUY_DINH_BAN_HANG_DOCX_VI, match: "same" },
            newValue: T_35_000_D_MOT_DON_VI,
            state: "open",
        })
        // Nothing changes for anyone before the founder's yes.
        expect(readsAt(world, frontDesk, AFTER)).toEqual([DELIVERY_FEE_VALUE_VI])
    })

    it("after approving, the front desk, in a customer conversation, reads the new fee once it takes effect, never two values", async () => {
        const world = await buildChangeWorld()
        world.byId.set(PUBLIC_FEE.id, PUBLIC_FEE)
        const filed = await world.requests.propose(facts.WS, salesRequest())

        await approve(world, filed.fact.id, PUBLIC_FEE.id)

        expect(frontDesk.audience).toBe("customer")
        expect(readsAt(world, frontDesk, BEFORE)).toEqual([DELIVERY_FEE_VALUE_VI])
        expect(readsAt(world, frontDesk, AFTER)).toEqual([T_35_000_D_MOT_DON_VI])
        expect(readsAt(world, salesOther, AFTER)).toEqual([T_35_000_D_MOT_DON_VI])
    })
})

describe("FX6: a new truth and a restricted truth, read through each lens", () => {
    it("a NEW truth told to Sales is filed workspace-wide (kind add) and read only through each lens: internal agents yes, the front desk no", async () => {
        const world = await buildChangeWorld()

        const filed = await world.requests.propose(facts.WS, salesRequest())

        expect(filed.fact).toMatchObject({ installationId: null, scope: "internal", conflictWith: null })
        expect(world.payloadOf(filed.fact.id)).toMatchObject({ kind: "add", current: null, oldValue: null })
        await approve(world, filed.fact.id, null)
        // Another agent of another instance reads it: the truth is the shop's, not the Sales instance's.
        expect(readsAt(world, hiring, AFTER)).toEqual([T_35_000_D_MOT_DON_VI])
        expect(readsAt(world, salesOther, AFTER)).toEqual([T_35_000_D_MOT_DON_VI])
        // The front desk's lens is public only: an internal truth stays out of its reach, whoever proposed it.
        expect(readsAt(world, frontDesk, AFTER)).toEqual([])
    })

    it("a change of a truth restricted to some modules keeps the restriction: an agent outside those modules never reads it", async () => {
        const world = await buildChangeWorld()
        const restricted = { ...PUBLIC_FEE, id: "f-restricted", scope: "restricted" as const, modules: ["sales"] }
        world.byId.set(restricted.id, restricted)

        const filed = await world.requests.propose(facts.WS, salesRequest())
        await approve(world, filed.fact.id, restricted.id)

        expect(filed.fact).toMatchObject({ installationId: null, scope: "restricted", modules: ["sales"] })
        expect(readsAt(world, salesOther, AFTER)).toEqual([T_35_000_D_MOT_DON_VI])
        expect(readsAt(world, hiring, AFTER)).toEqual([])
        expect(readsAt(world, frontDesk, AFTER)).toEqual([])
    })
})
