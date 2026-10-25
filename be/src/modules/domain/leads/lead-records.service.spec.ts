import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadsErrorCode } from "./errors/leads.error"
import { LeadRecordsService } from "./lead-records.service"
import type { LeadRecordRow } from "./persistence/lead-records.rows"
import {
    APPLY_CLASSIFICATION,
    APPLY_PUBLIC_LEAD_STAGE,
    FILL_LEAD_CONTACT,
    FIND_LEAD,
    FIND_LEAD_NAMES,
    HAND_OVER_LEAD_NEED,
    INSERT_LEAD,
    MATCH_LEAD,
    MARK_LEAD_WON,
    PATCH_PUBLIC_LEAD,
    REPLACE_LEAD_CONTEXT,
} from "./persistence/lead-records.sql"

const ROW: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "An",
    company: "ACME",
    channel: "Zalo",
    need: "price",
    stage: "new",
    context_summary: null,
    phone: "84912000701",
    email: null,
}

const build = async (rows: ReadonlyArray<LeadRecordRow> = [ROW]) => {
    const em = mockEntityManager({
        query: [
            [FIND_LEAD, rows],
            [MATCH_LEAD, rows],
            [INSERT_LEAD, rows],
            [FIND_LEAD_NAMES, [{ id: "lead-1", contact_name: "An" }]],
            [HAND_OVER_LEAD_NEED, []],
            [FILL_LEAD_CONTACT, []],
            [APPLY_CLASSIFICATION, []],
            [MARK_LEAD_WON, []],
            [REPLACE_LEAD_CONTEXT, []],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [LeadRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { records: moduleRef.get(LeadRecordsService), em }
}

describe("LeadRecordsService", () => {
    it("reads one lead of the workspace", async () => {
        const { records } = await build()

        await expect(records.find("ws-1", "lead-1")).resolves.toEqual(ROW)
    })

    it("answers null when the lead is absent and refuses require", async () => {
        const { records } = await build([])

        await expect(records.find("ws-1", "missing")).resolves.toBeNull()
        await expect(records.require("ws-1", "missing")).rejects.toMatchObject({
            code: LeadsErrorCode.NotFound,
            params: { id: "missing" },
        })
    })

    it("matches a customer by phone and treats a blank name as no name", async () => {
        const { records, em } = await build()

        await expect(
            records.match({
                workspaceId: "ws-1",
                phone: "84912000701",
                email: null,
                name: "  ",
                channel: "Zalo",
            }),
        ).resolves.toEqual(ROW)

        expect(em.query).toHaveBeenCalledWith(MATCH_LEAD, ["ws-1", "84912000701", null, null, "Zalo"])
    })

    it("captures a customer and answers the inserted row", async () => {
        const { records, em } = await build()

        await expect(
            records.capture({
                workspaceId: "ws-1",
                contactName: "An",
                company: "ACME",
                channel: "Zalo",
                need: "price",
                phone: "84912000701",
                email: null,
            }),
        ).resolves.toEqual(ROW)

        expect(em.query).toHaveBeenCalledWith(INSERT_LEAD, ["ws-1", "An", "ACME", "Zalo", "price", "84912000701", null])
    })

    it("hands over the package as the lead's need", async () => {
        const { records, em } = await build()
        const need = "Annual sales package"

        await expect(records.handOver("ws-1", "lead-1", need)).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(HAND_OVER_LEAD_NEED, ["ws-1", "lead-1", need])
    })
})

describe("LeadRecordsService", () => {
    it("answers no names when no leads were asked for", async () => {
        const { records, em } = await build()

        await expect(records.namesOf("ws-1", [])).resolves.toEqual([])

        expect(em.query).not.toHaveBeenCalled()
    })

    it("requires an existing lead from the requested workspace", async () => {
        const { records, em } = await build()

        await expect(records.require("ws-1", "lead-1")).resolves.toEqual(ROW)

        expect(em.query).toHaveBeenCalledWith(FIND_LEAD, ["ws-1", "lead-1"])
    })

    it("matches a trimmed customer name", async () => {
        const { records, em } = await build()

        await expect(
            records.match({
                workspaceId: "ws-1",
                phone: null,
                email: null,
                name: "  An  ",
                channel: "Zalo",
            }),
        ).resolves.toEqual(ROW)

        expect(em.query).toHaveBeenCalledWith(MATCH_LEAD, ["ws-1", null, null, "An", "Zalo"])
    })

    it("answers null for an unmatched input without a customer name", async () => {
        const { records, em } = await build([])

        await expect(
            records.match({ workspaceId: "ws-1", phone: null, email: null, name: null, channel: null }),
        ).resolves.toBeNull()

        expect(em.query).toHaveBeenCalledWith(MATCH_LEAD, ["ws-1", null, null, null, null])
    })

    it("refuses a capture that did not insert a row", async () => {
        const { records, em } = await build([])

        await expect(
            records.capture({
                workspaceId: "ws-1",
                contactName: "An",
                company: "ACME",
                channel: "Zalo",
                need: "price",
                phone: null,
                email: "an@example.test",
            }),
        ).rejects.toMatchObject({ code: LeadsErrorCode.NotFound, params: { id: "new" } })

        expect(em.query).toHaveBeenCalledWith(INSERT_LEAD, [
            "ws-1",
            "An",
            "ACME",
            "Zalo",
            "price",
            null,
            "an@example.test",
        ])
    })
})

describe("LeadRecordsService", () => {
    it("writes the supplied missing contact and classification values", async () => {
        const { records, em } = await build()

        await expect(
            records.fillContact({ workspaceId: "ws-1", leadId: "lead-1", phone: null, email: "an@example.test" }),
        ).resolves.toBeUndefined()
        await expect(
            records.classify({
                workspaceId: "ws-1",
                leadId: "lead-1",
                stage: "qualified",
                contextSummary: "Needs menu",
            }),
        ).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(FILL_LEAD_CONTACT, ["ws-1", "lead-1", null, "an@example.test"])
        expect(em.query).toHaveBeenCalledWith(APPLY_CLASSIFICATION, ["ws-1", "lead-1", "qualified", "Needs menu"])
    })

    it("replaces context through the default manager", async () => {
        const { records, em } = await build()

        await expect(records.replaceContext("ws-1", "lead-1", "Refreshed context")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(REPLACE_LEAD_CONTEXT, ["ws-1", "lead-1", "Refreshed context"])
    })

    it("replaces context through a supplied transaction manager", async () => {
        const { records, em } = await build()
        const manager = mockEntityManager({ query: [REPLACE_LEAD_CONTEXT, []] })

        await expect(records.replaceContext("ws-1", "lead-1", "Transaction context", manager)).resolves.toBeUndefined()

        expect(manager.query).toHaveBeenCalledWith(REPLACE_LEAD_CONTEXT, ["ws-1", "lead-1", "Transaction context"])
        expect(em.query).not.toHaveBeenCalled()
    })

    it("marks a won lead and reads the requested lead names", async () => {
        const { records, em } = await build()

        await expect(records.markWon("ws-1", "lead-1")).resolves.toBeUndefined()
        await expect(records.namesOf("ws-1", ["lead-1"])).resolves.toEqual([{ id: "lead-1", contact_name: "An" }])

        expect(em.query).toHaveBeenCalledWith(MARK_LEAD_WON, ["ws-1", "lead-1"])
        expect(em.query).toHaveBeenCalledWith(FIND_LEAD_NAMES, ["ws-1", ["lead-1"]])
    })
})

describe("LeadRecordsService public API transaction", () => {
    it("uses the supplied manager when finding and matching a customer", async () => {
        const { records, em } = await build([])
        const manager = mockEntityManager({
            query: [
                [FIND_LEAD, [ROW]],
                [MATCH_LEAD, [ROW]],
            ],
        })
        const match = { workspaceId: "ws-1", phone: "84912000701", email: null, name: "An", channel: "Zalo" }

        await expect(records.find("ws-1", "lead-1", manager)).resolves.toEqual(ROW)
        await expect(records.match(match, manager)).resolves.toEqual(ROW)

        expect(manager.query).toHaveBeenCalledWith(FIND_LEAD, ["ws-1", "lead-1"])
        expect(manager.query).toHaveBeenCalledWith(MATCH_LEAD, ["ws-1", "84912000701", null, "An", "Zalo"])
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([null, "Updated need"])(
        "passes a supplied need or preservation marker through the transaction: %s",
        async (need) => {
            const { records, em } = await build()
            const manager = mockEntityManager({ query: [PATCH_PUBLIC_LEAD, []] })

            await expect(
                records.patchPublicFacts(
                    { workspaceId: "ws-1", leadId: "lead-1", company: "New company", need },
                    manager,
                ),
            ).resolves.toBeUndefined()

            expect(manager.query).toHaveBeenCalledWith(PATCH_PUBLIC_LEAD, ["ws-1", "lead-1", "New company", need])
            expect(em.query).not.toHaveBeenCalled()
        },
    )

    it.each([
        [[ROW], ROW],
        [[], null],
    ] as const)("returns the changed stage row or no change from the transaction: %j", async (rows, expected) => {
        const { records, em } = await build()
        const manager = mockEntityManager({ query: [APPLY_PUBLIC_LEAD_STAGE, rows] })

        await expect(records.applyPublicStage("ws-1", "lead-1", "won", manager)).resolves.toEqual(expected)

        expect(manager.query).toHaveBeenCalledWith(APPLY_PUBLIC_LEAD_STAGE, ["ws-1", "lead-1", "won"])
        expect(em.query).not.toHaveBeenCalled()
    })
})
