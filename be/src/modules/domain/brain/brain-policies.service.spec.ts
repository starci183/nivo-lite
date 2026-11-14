import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsError, BrainFactsErrorCode, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord, ProposeResult } from "@modules/domain/brain-facts"
import { CritiqueDecisionsService } from "@modules/domain/dossier-review"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import {
    WorkspaceMembersError,
    WorkspaceMembersErrorCode,
} from "@modules/domain/workspace-members/errors/workspace-members.error"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { BrainPoliciesService } from "./brain-policies.service"
import { FEE, OLD_FEE, PRODUCT, UNSET_PROPOSAL, WAITING_RULE, factOf } from "@tests/fixtures/builders/brain-b.builder"
import { BA_MUOI_NGHIN_VI, CHU_TIEM_CHINH_TRUC_TIEP_VI, GIAO_HANG_NOI_THANH_VI, GIU_CHO_VI, LAN_SUA_TREN_TAB_CHINH_SACH_VI, LOP_YOGA_VI, PHI_GIAO_HANG_VI, V_10_PHUT_VI, V_15_PHUT_VI, V_20_PHUT_VI, V_30_000_D_MOT_DON_VI, V_30_000_D_VI, V_35_000_D_MOT_DON_VI, V_40_000_D_MOT_DON_VI, V_60_000_D_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"

const WS = "ws-1"
const NOW = "2026-11-11T10:00:00.000Z"
const LATER = "2026-12-01T00:00:00.000Z"

const memberOf = (role: WorkspaceMember["role"]): WorkspaceMember => ({
    userId: "u1",
    workspaceId: WS,
    role,
    staffId: null,
    displayName: role === "owner" ? "Ada" : "Lan",
    status: "active",
})

const build = async (role: WorkspaceMember["role"]) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockImplementation((_user, _ws, roles = []) =>
        roles.length > 0 && !roles.includes(role)
            ? Promise.reject(new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.RoleForbidden }))
            : Promise.resolve(memberOf(role)),
    )
    const reads = mock<BrainFactsReadService>()
    const facts = mock<BrainFactsService>()
    const decisions = mock<CritiqueDecisionsService>()
    facts.maintain.mockResolvedValue({ activated: [], expired: 0 })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainPoliciesService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactsService, useValue: facts },
            { provide: CritiqueDecisionsService, useValue: decisions },
        ],
    }).compile()
    return { service: moduleRef.get(BrainPoliciesService), reads, facts, members, decisions }
}

/** The answer of `propose` for a stored fact. */
const proposed = (fact: FactRecord): ProposeResult => ({ fact, outcome: "applied", created: true })

/** The founder's reading of a gym rule that waits, with the facts around it. */
    const withWaiting = async (role: WorkspaceMember["role"], others: ReadonlyArray<FactRecord> = []) => {
        const built = await build(role)
        built.reads.get.mockResolvedValue(WAITING_RULE)
        built.reads.list.mockResolvedValue([WAITING_RULE, ...others])
        return built
    }

/** A member of the given role reads the delivery FEE and its older version. */
    const withFee = async (role: WorkspaceMember["role"]) => {
        const built = await build(role)
        built.reads.get.mockResolvedValue(FEE)
        built.reads.list.mockResolvedValue([FEE, OLD_FEE])
        return built
    }

describe("BrainPoliciesService: who may edit", () => {
    it("refuses staff on every door", async () => {
        const { service } = await build("staff")
        await expect(service.set("u1", { workspaceId: WS, factId: "fee", value: "35k" })).rejects.toBeInstanceOf(
            WorkspaceMembersError,
        )
        await expect(service.unset("u1", { workspaceId: WS, factId: "fee" })).rejects.toBeInstanceOf(
            WorkspaceMembersError,
        )
    })

    it("corrects ANY truth the founder points at, whatever its subject type and whatever the policy layer made of it (D-U-8)", async () => {
        const { service, facts, reads } = await build("owner")
        reads.get.mockResolvedValue(PRODUCT)
        reads.list.mockResolvedValue([PRODUCT])
        facts.propose.mockResolvedValue(proposed(factOf({ ...PRODUCT, id: "rose-v2", value: V_60_000_D_VI })))

        await expect(service.set("u1", { workspaceId: WS, factId: "rose", value: "60k" })).resolves.toMatchObject({
            outcome: "applied",
            factId: "rose-v2",
        })
        await expect(service.unset("u1", { workspaceId: WS, factId: "rose" })).resolves.toEqual({
            outcome: "retired",
        })

        // The founder's word: source owner, applied at once, through the one facts write path.
        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({
            subjectType: "product",
            value: V_60_000_D_VI,
            sourceKind: "owner",
            autoApply: true,
        })
        expect(facts.retire).toHaveBeenCalledWith(WS, "rose", "Ada", CHU_TIEM_CHINH_TRUC_TIEP_VI)
        // A truth in force that was corrected leaves nothing to close.
        expect(facts.reject).not.toHaveBeenCalled()
    })
})

describe("BrainPoliciesService: a waiting truth the founder corrects (D-U-8)", () => {
    it("another value: the founder's own truth goes in force and the waiting value he corrected is closed, naming it", async () => {
        const { service, facts, decisions } = await withWaiting("owner")
        facts.propose.mockResolvedValue(proposed(factOf({ ...WAITING_RULE, id: "own", status: "active", sourceKind: "owner", value: V_20_PHUT_VI })))

        await expect(service.set("u1", { workspaceId: WS, factId: "w-hold", value: V_20_PHUT_VI })).resolves.toEqual({
            outcome: "applied",
            problem: null,
            factId: "own",
            value: V_20_PHUT_VI,
        })

        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({
            subjectLabel: LOP_YOGA_VI,
            attributeLabel: GIU_CHO_VI,
            value: V_20_PHUT_VI,
            sourceKind: "owner",
            autoApply: true,
        })
        expect(facts.reject.mock.calls).toEqual([[WS, "w-hold", "Ada", "corrected-by-founder:own"]])
        // The critic is told which truth his correction closed, AFTER the close: the other open points that name it close too.
        expect(decisions.turnedDown.mock.calls).toEqual([[WS, ["w-hold"]]])
        const [closed = 0] = facts.reject.mock.invocationCallOrder
        const [told = 0] = decisions.turnedDown.mock.invocationCallOrder
        expect(told).toBeGreaterThan(closed)
    })

    it("the same value is its approval: the waiting truth itself goes in force as decided by him, nothing is closed", async () => {
        const { service, facts, reads, decisions } = await withWaiting("owner")
        const approved = factOf({ ...WAITING_RULE, status: "active", decidedBy: "Ada" })
        facts.propose.mockResolvedValue({ fact: approved, outcome: "applied" })
        // Read again after the write: it no longer waits.
        reads.get.mockResolvedValueOnce(WAITING_RULE).mockResolvedValue(approved)

        await expect(service.set("u1", { workspaceId: WS, factId: "w-hold", value: V_15_PHUT_VI })).resolves.toMatchObject({
            outcome: "applied",
            factId: "w-hold",
        })

        expect(facts.reject).not.toHaveBeenCalled()
        // Nothing was turned down: the approval is announced by the store itself (`factsChanged`).
        expect(decisions.turnedDown).not.toHaveBeenCalled()
    })
})

describe("BrainPoliciesService: a waiting truth meets another value or another hand (D-U-8)", () => {
    it("a waiting value that argues with the value in force: the founder types the value in force again, and the waiting one is closed", async () => {
        const standing = factOf({ ...WAITING_RULE, id: "hold", status: "active", value: V_10_PHUT_VI, decidedBy: "Ada" })
        const { service, facts } = await withWaiting("owner", [standing])

        await expect(service.set("u1", { workspaceId: WS, factId: "w-hold", value: V_10_PHUT_VI })).resolves.toMatchObject({
            outcome: "unchanged",
            factId: "hold",
        })

        expect(facts.propose).not.toHaveBeenCalled()
        expect(facts.reject.mock.calls).toEqual([[WS, "w-hold", "Ada", "corrected-by-founder:hold"]])
    })

    it("a value decided by someone else meanwhile is left as decided: the founder's edit still stands", async () => {
        const { service, facts } = await withWaiting("owner")
        facts.propose.mockResolvedValue(proposed(factOf({ ...WAITING_RULE, id: "own", status: "active", value: V_20_PHUT_VI })))
        facts.reject.mockRejectedValue(new BrainFactsError({ code: BrainFactsErrorCode.NotProposed }))

        await expect(service.set("u1", { workspaceId: WS, factId: "w-hold", value: V_20_PHUT_VI })).resolves.toMatchObject({
            outcome: "applied",
            factId: "own",
        })
    })

    it("a manager's edit is a proposal: it closes nothing; the audience switch alone closes nothing either", async () => {
        const manager = await withWaiting("manager")
        manager.facts.propose.mockResolvedValue({
            fact: factOf({ ...WAITING_RULE, id: "p-lan", value: V_20_PHUT_VI }),
            outcome: "conflict",
            created: true,
        })
        await expect(manager.service.set("u1", { workspaceId: WS, factId: "w-hold", value: V_20_PHUT_VI })).resolves.toMatchObject({
            outcome: "proposed",
        })
        expect(manager.facts.reject).not.toHaveBeenCalled()
        expect(manager.decisions.turnedDown).not.toHaveBeenCalled()

        const standing = factOf({ ...WAITING_RULE, id: "hold", status: "active", value: V_10_PHUT_VI })
        const owner = await withWaiting("owner", [standing])
        owner.facts.setReach.mockResolvedValue(factOf({ ...standing, id: "hold-v2", scope: "public" }))
        await expect(owner.service.set("u1", { workspaceId: WS, factId: "w-hold", audience: "public" })).resolves.toMatchObject({
            outcome: "applied",
            factId: "hold-v2",
        })
        expect(owner.facts.reject).not.toHaveBeenCalled()
    })
})

describe("BrainPoliciesService: write, a new value and a window", () => {
    it("owner: writes the next version of the fact at once, workspace-wide, source: the shop owner edited it directly, no other call", async () => {
        const { service, facts } = await withFee("owner")
        facts.propose.mockResolvedValue(proposed(factOf({ id: "fee-v3", value: V_35_000_D_MOT_DON_VI, version: 3 })))

        const result = await service.set("u1", { workspaceId: WS, factId: "fee", value: "35k" })

        expect(result).toEqual({ outcome: "applied", problem: null, factId: "fee-v3", value: V_35_000_D_MOT_DON_VI })
        expect(facts.maintain).toHaveBeenCalledWith(WS)
        expect(facts.propose).toHaveBeenCalledWith(WS, {
            subjectType: "service",
            subjectLabel: GIAO_HANG_NOI_THANH_VI,
            attributeLabel: PHI_GIAO_HANG_VI,
            value: V_35_000_D_MOT_DON_VI,
            unit: null,
            scope: undefined,
            modules: [],
            sourceKind: "owner",
            autoApply: true,
            validFrom: undefined,
            validTo: undefined,
            installationId: null,
            proposedBy: "Ada",
            evidence: [
                {
                    kind: "manual",
                    ref: `policy:fee:${String(Date.parse(NOW))}`,
                    label: CHU_TIEM_CHINH_TRUC_TIEP_VI,
                    quote: V_35_000_D_MOT_DON_VI,
                    at: NOW,
                },
            ],
        })
    })

    it("owner: a later start is scheduled", async () => {
        const { service, facts } = await withFee("owner")
        facts.propose.mockResolvedValue(
            proposed(factOf({ id: "fee-later", status: "scheduled", validFrom: LATER })),
        )

        const result = await service.set("u1", { workspaceId: WS, factId: "fee", value: "40000", validFrom: LATER })

        expect(result.outcome).toBe("scheduled")
        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({
            validFrom: LATER,
            value: V_40_000_D_MOT_DON_VI,
            autoApply: true,
        })
    })

    it("owner: switches 'Customer-visible' on together with a new value", async () => {
        const { service, facts } = await withFee("owner")
        facts.propose.mockResolvedValue(proposed(factOf({ id: "fee-v3", scope: "public" })))

        await service.set("u1", { workspaceId: WS, factId: "fee", value: "35k", audience: "public" })

        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({ scope: "public" })
    })

    it("manager: files a proposal for the owner and says so", async () => {
        const { service, facts } = await withFee("manager")
        facts.propose.mockResolvedValue({
            fact: factOf({ id: "p-lan", status: "proposed" }),
            outcome: "conflict",
            created: true,
        })

        const result = await service.set("u1", { workspaceId: WS, factId: "fee", value: "35k" })

        expect(result).toMatchObject({ outcome: "proposed", factId: "p-lan" })
        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({
            sourceKind: "manager",
            autoApply: false,
            evidence: [expect.objectContaining({ label: LAN_SUA_TREN_TAB_CHINH_SACH_VI })],
        })
    })
})

describe("BrainPoliciesService: write, checks and the same value", () => {
    it("refuses a value that is not the row's type, a window that ends before it starts, and a fact that does not exist", async () => {
        const { service, facts, reads } = await withFee("owner")

        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", value: BA_MUOI_NGHIN_VI }),
        ).resolves.toMatchObject({
            outcome: "invalid",
            problem: "not_money",
        })
        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", value: "35k", validFrom: LATER, validTo: NOW }),
        ).resolves.toMatchObject({ outcome: "invalid", problem: "window" })
        await expect(service.set("u1", { workspaceId: WS, factId: "fee" })).resolves.toMatchObject({
            problem: "nothing_to_change",
        })
        reads.get.mockResolvedValueOnce(null)
        await expect(service.set("u1", { workspaceId: WS, factId: "x", value: "1k" })).resolves.toMatchObject({
            problem: "not_found",
        })
        expect(facts.propose).not.toHaveBeenCalled()
    })

    it("writes no new version for the value already in force", async () => {
        const { service, facts } = await withFee("owner")

        const result = await service.set("u1", { workspaceId: WS, factId: "fee", value: V_30_000_D_VI })

        expect(result).toEqual({ outcome: "unchanged", problem: null, factId: "fee", value: V_30_000_D_MOT_DON_VI })
        expect(facts.propose).not.toHaveBeenCalled()
    })

    it("owner: the same value with a NEW end is a change: the next version, applied (BRAIN-LIMITS item 5)", async () => {
        const { service, facts } = await withFee("owner")
        const END = "2026-12-31T00:00:00.000Z"
        facts.propose.mockResolvedValue(proposed(factOf({ id: "fee-v3", version: 3, validTo: END })))

        const result = await service.set("u1", { workspaceId: WS, factId: "fee", value: V_30_000_D_VI, validTo: END })

        expect(result).toEqual({ outcome: "applied", problem: null, factId: "fee-v3", value: V_30_000_D_MOT_DON_VI })
        expect(facts.propose.mock.calls[0]?.[1]).toMatchObject({
            value: V_30_000_D_MOT_DON_VI,
            validTo: END,
            autoApply: true,
            sourceKind: "owner",
        })
        // The window alone (no value typed) is the same change.
        await service.set("u1", { workspaceId: WS, factId: "fee", validTo: END })
        expect(facts.propose.mock.calls[1]?.[1]).toMatchObject({ value: V_30_000_D_MOT_DON_VI, validTo: END })
    })

    it("owner: the same value from a later start is scheduled; a manager's window edit is a proposal", async () => {
        const owner = await withFee("owner")
        owner.facts.propose.mockResolvedValue(proposed(factOf({ id: "fee-later", status: "scheduled", validFrom: LATER })))
        await expect(
            owner.service.set("u1", { workspaceId: WS, factId: "fee", value: V_30_000_D_VI, validFrom: LATER }),
        ).resolves.toMatchObject({ outcome: "scheduled", factId: "fee-later" })

        const manager = await withFee("manager")
        manager.facts.propose.mockResolvedValue({ fact: factOf({ id: "p-lan", status: "proposed" }), outcome: "conflict", created: true })
        await expect(
            manager.service.set("u1", { workspaceId: WS, factId: "fee", validTo: "2026-12-31T00:00:00.000Z" }),
        ).resolves.toMatchObject({ outcome: "proposed", factId: "p-lan" })
        expect(manager.facts.propose.mock.calls[0]?.[1]).toMatchObject({ autoApply: false, sourceKind: "manager" })
    })
})

describe("BrainPoliciesService: write, the audience and the end", () => {
    it("the same end as the one in force is no change, and a window that ends before it starts stays invalid / window", async () => {
        const { service, facts } = await withFee("owner")

        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", value: V_30_000_D_VI, validTo: FEE.validTo ?? "" }),
        ).resolves.toMatchObject({ outcome: "unchanged" })
        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", value: V_30_000_D_VI, validFrom: LATER, validTo: NOW }),
        ).resolves.toMatchObject({ outcome: "invalid", problem: "window" })
        expect(facts.propose).not.toHaveBeenCalled()
    })

    it("owner: switches 'Customer-visible' alone: the next version through setReach, no value written, no other write", async () => {
        const { service, facts } = await withFee("owner")
        facts.setReach.mockResolvedValue(factOf({ id: "fee-v3", scope: "public", version: 3 }))

        const result = await service.set("u1", { workspaceId: WS, factId: "fee", audience: "public" })

        expect(result).toEqual({ outcome: "applied", problem: null, factId: "fee-v3", value: V_30_000_D_MOT_DON_VI })
        expect(facts.maintain).toHaveBeenCalledWith(WS)
        expect(facts.setReach.mock.calls).toEqual([[WS, "fee", { scope: "public", modules: [] }, "Ada"]])
        expect(facts.propose).not.toHaveBeenCalled()
    })

    it("owner: the same value typed again with the switch changes only who reads it", async () => {
        const { service, facts } = await withFee("owner")
        facts.setReach.mockResolvedValue(factOf({ id: "fee-v3", scope: "public" }))

        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", value: V_30_000_D_VI, audience: "public" }),
        ).resolves.toMatchObject({ outcome: "applied", factId: "fee-v3" })
        expect(facts.setReach).toHaveBeenCalledWith(WS, "fee", { scope: "public", modules: [] }, "Ada")
        expect(facts.propose).not.toHaveBeenCalled()
    })

    it("switching off a public value makes it internal again; the audience it already has is no change", async () => {
        const { service, facts, reads } = await withFee("owner")
        const open = factOf({ ...FEE, scope: "public" })
        reads.get.mockResolvedValue(open)
        reads.list.mockResolvedValue([open, OLD_FEE])
        facts.setReach.mockResolvedValue(factOf({ id: "fee-v3" }))

        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", audience: "internal" }),
        ).resolves.toMatchObject({
            outcome: "applied",
        })
        expect(facts.setReach).toHaveBeenCalledWith(WS, "fee", { scope: "internal", modules: [] }, "Ada")
        await expect(
            service.set("u1", { workspaceId: WS, factId: "fee", audience: "public" }),
        ).resolves.toMatchObject({
            problem: "nothing_to_change",
        })
        expect(facts.setReach).toHaveBeenCalledTimes(1)
    })
})

describe("BrainPoliciesService: write, the switch alone and unset", () => {
    it("refuses the switch alone to a manager, and with no value in force", async () => {
        const manager = await withFee("manager")
        await expect(
            manager.service.set("u1", { workspaceId: WS, factId: "fee", audience: "public" }),
        ).resolves.toMatchObject({
            outcome: "invalid",
            problem: "owner_only",
        })
        expect(manager.facts.setReach).not.toHaveBeenCalled()

        const unset = await build("owner")
        unset.reads.get.mockResolvedValue(UNSET_PROPOSAL)
        unset.reads.list.mockResolvedValue([UNSET_PROPOSAL])
        await expect(
            unset.service.set("u1", { workspaceId: WS, factId: "p-express", audience: "public" }),
        ).resolves.toEqual({
            outcome: "invalid",
            problem: "not_in_force",
            factId: null,
            value: null,
        })
        expect(unset.facts.setReach).not.toHaveBeenCalled()
        expect(unset.facts.propose).not.toHaveBeenCalled()
    })

    it("unset: the owner retires the value in force, a manager files a retire proposal, nothing in force is unchanged", async () => {
        const owner = await withFee("owner")
        await expect(owner.service.unset("u1", { workspaceId: WS, factId: "fee" })).resolves.toEqual({
            outcome: "retired",
        })
        expect(owner.facts.retire).toHaveBeenCalledWith(WS, "fee", "Ada", CHU_TIEM_CHINH_TRUC_TIEP_VI)

        const manager = await withFee("manager")
        await expect(manager.service.unset("u1", { workspaceId: WS, factId: "fee" })).resolves.toEqual({
            outcome: "proposed",
        })
        expect(manager.facts.proposeRetire).toHaveBeenCalledWith(
            WS,
            FEE,
            expect.objectContaining({ kind: "manual" }),
            "Lan",
            "manager",
        )

        const empty = await withFee("owner")
        empty.reads.list.mockResolvedValue([OLD_FEE])
        await expect(empty.service.unset("u1", { workspaceId: WS, factId: "fee" })).resolves.toEqual({
            outcome: "unchanged",
        })
    })
})
