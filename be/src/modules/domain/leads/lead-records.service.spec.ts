import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadsErrorCode } from "./errors/leads.error"
import { LeadRecordsService } from "./lead-records.service"
import type { LeadRecordRow } from "./persistence/lead-records.rows"
import {
    FIND_LEAD,
    FIND_LEAD_NAMES,
    HAND_OVER_LEAD_NEED,
    INSERT_LEAD,
    MATCH_LEAD,
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
    origin: "live",
}

const build = async (rows: ReadonlyArray<LeadRecordRow> = [ROW]) => {
    const em = mockEntityManager({
        query: [
            [FIND_LEAD, rows],
            [MATCH_LEAD, rows],
            [INSERT_LEAD, rows],
            [FIND_LEAD_NAMES, [{ id: "lead-1", contact_name: "An" }]],
            [HAND_OVER_LEAD_NEED, []],
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

        expect(em.query).toHaveBeenCalledWith(MATCH_LEAD, ["ws-1", "84912000701", null, null, "Zalo", "live"])
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
                origin: "live",
            }),
        ).resolves.toEqual(ROW)

        expect(em.query).toHaveBeenCalledWith(INSERT_LEAD, [
            "ws-1",
            "An",
            "ACME",
            "Zalo",
            "price",
            "84912000701",
            null,
            "live",
        ])
    })

    it("hands over the package as the lead's need", async () => {
        const { records, em } = await build()
        const need = "Annual sales package"

        await expect(records.handOver("ws-1", "lead-1", need)).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(HAND_OVER_LEAD_NEED, ["ws-1", "lead-1", need])
    })

    it("answers no names when no leads were asked for", async () => {
        const { records, em } = await build()

        await expect(records.namesOf("ws-1", [])).resolves.toEqual([])

        expect(em.query).not.toHaveBeenCalled()
    })
})
