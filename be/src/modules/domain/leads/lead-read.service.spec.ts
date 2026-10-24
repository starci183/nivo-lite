import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadsErrorCode } from "./errors/leads.error"
import type { LeadView } from "./lead-read.contracts"
import { LeadReadService } from "./lead-read.service"
import {
    FIND_LEAD_VIEW,
    LIST_LEAD_VIEW_PAGE,
    LIST_LEAD_VIEWS,
    LIST_LEAD_VIEWS_BY_IDS,
} from "./persistence/lead-read.sql"
import { normalizePage } from "@modules/platform/pagination"
import { HttpSecurityErrorCode } from "@modules/platform/http-security"

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

const PAGE_LEAD: LeadView = {
    ...LEAD,
    id: "00000000-0000-4000-8000-000000000002",
    created_at: "2026-10-12T03:00:00.123456+00:00",
}

const NEXT_LEAD: LeadView = { ...PAGE_LEAD, id: "00000000-0000-4000-8000-000000000001" }

const build = async () => {
    const em = mockEntityManager({
        query: [
            [LIST_LEAD_VIEWS, [LEAD]],
            [LIST_LEAD_VIEW_PAGE, [PAGE_LEAD, NEXT_LEAD]],
            [LIST_LEAD_VIEWS_BY_IDS, [LEAD]],
            [FIND_LEAD_VIEW, [LEAD]],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [LeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { leads: moduleRef.get(LeadReadService), em }
}

const registerPageReads = () => {
    it("reads one extra lead to establish continuation and preserves the exact timestamp and id", async () => {
        const { leads, em } = await build()

        const result = await leads.listPage("ws-1", { first: 1 })

        expect(result.nodes).toEqual([PAGE_LEAD])
        expect(result.pageInfo.hasNextPage).toBe(true)
        expect(normalizePage({ after: result.pageInfo.endCursor }, "leadBoard:ws-1").after).toEqual({
            createdAt: PAGE_LEAD.created_at,
            id: PAGE_LEAD.id,
        })
        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_VIEW_PAGE, ["ws-1", null, null, 2])
    })

    it("passes the exact cursor boundary into the next scoped database read", async () => {
        const { leads, em } = await build()
        const first = await leads.listPage("ws-1", { first: 1 })

        await leads.listPage("ws-1", { first: 1, after: first.pageInfo.endCursor })

        expect(em.query).toHaveBeenLastCalledWith(LIST_LEAD_VIEW_PAGE, ["ws-1", PAGE_LEAD.created_at, PAGE_LEAD.id, 2])
    })

    it("uses the shared bounded default and answers an empty final page", async () => {
        const em = mockEntityManager({ query: [LIST_LEAD_VIEW_PAGE, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [LeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        const leads = moduleRef.get(LeadReadService)

        await expect(leads.listPage("ws-1", {})).resolves.toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_VIEW_PAGE, ["ws-1", null, null, 51])
    })
}

const registerPageRefusals = () => {
    it("refuses an oversized page before reading leads", async () => {
        const { leads, em } = await build()

        await expect(leads.listPage("ws-1", { first: 101 })).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses another workspace's cursor before reading leads", async () => {
        const { leads, em } = await build()
        const first = await leads.listPage("ws-1", { first: 1 })
        em.query.mockClear()

        await expect(leads.listPage("ws-2", { after: first.pageInfo.endCursor })).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })
}

describe("LeadReadService", () => {
    it("lists the recent leads of the workspace", async () => {
        const { leads, em } = await build()

        await expect(leads.list("ws-1")).resolves.toEqual([LEAD])

        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_VIEWS, ["ws-1"])
    })

    registerPageReads()
    registerPageRefusals()

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
