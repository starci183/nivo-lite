import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadsErrorCode } from "./errors/leads.error"
import type { LeadView } from "./lead-read.contracts"
import { LeadReadService } from "./lead-read.service"
import { FIND_LEAD_VIEW, LIST_LEAD_VIEWS, LIST_LEAD_VIEWS_BY_IDS } from "./persistence/lead-read.sql"

const LEAD: LeadView = {
    id: "lead-1",
    contact_name: "An",
    company: "ACME",
    channel: "Zalo",
    need: "price",
    stage: "new",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-12T03:00:00.000Z",
}

const build = async () => {
    const em = mockEntityManager({
        query: [
            [LIST_LEAD_VIEWS, [LEAD]],
            [LIST_LEAD_VIEWS_BY_IDS, [LEAD]],
            [FIND_LEAD_VIEW, [LEAD]],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [LeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { leads: moduleRef.get(LeadReadService), em }
}

describe("LeadReadService", () => {
    it("lists the recent leads of the workspace", async () => {
        const { leads, em } = await build()

        await expect(leads.list("ws-1")).resolves.toEqual([LEAD])

        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_VIEWS, ["ws-1"])
    })

    it("answers no rows when the id list is empty", async () => {
        const { leads, em } = await build()

        await expect(leads.listByIds("ws-1", [])).resolves.toEqual([])

        expect(em.query).not.toHaveBeenCalled()
    })

    it("reads the requested leads", async () => {
        const { leads } = await build()

        await expect(leads.listByIds("ws-1", ["lead-1"])).resolves.toEqual([LEAD])
    })

    it("refuses a lead the workspace does not have", async () => {
        const em = mockEntityManager({ query: [FIND_LEAD_VIEW, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [LeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        const leads = moduleRef.get(LeadReadService)

        await expect(leads.require("ws-1", "missing")).rejects.toMatchObject({
            code: LeadsErrorCode.NotFound,
            params: { id: "missing" },
        })
    })

    it("requires the requested lead within its workspace", async () => {
        const { leads, em } = await build()

        await expect(leads.require("ws-1", "lead-1")).resolves.toEqual(LEAD)

        expect(em.query).toHaveBeenCalledWith(FIND_LEAD_VIEW, ["ws-1", "lead-1"])
    })

    it("scopes a bounded id lookup to the workspace and requested ids", async () => {
        const { leads, em } = await build()
        const ids = ["lead-1", "lead-older"]

        await expect(leads.listByIds("ws-1", ids)).resolves.toEqual([LEAD])

        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_VIEWS_BY_IDS, ["ws-1", ids])
    })
})
