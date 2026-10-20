import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BrandProposalClosing } from "./content-brand-proposals.contracts"
import { ContentBrandProposalsService } from "./content-brand-proposals.service"
import {
    CLOSE_BRAND_PROPOSAL,
    FIND_BRAND_PROPOSAL,
    INSERT_BRAND_PROPOSAL,
    LIST_BRAND_PROPOSALS,
} from "./persistence/content-brand-proposals.sql"

const ROW = {
    id: "p-1",
    workspace_id: "ws-1",
    installation_id: "inst-1",
    setup_session_id: null,
    file_name: "guide.pdf",
    file_size: 4,
    payload: { tone: "Warm" },
    status: "proposed",
    decided_by: null,
    created_at: "2026-10-20T00:00:00.000Z",
}
const RECORD = {
    id: "p-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    setupSessionId: null,
    fileName: "guide.pdf",
    fileSize: 4,
    payload: { tone: "Warm" },
    status: "proposed",
    decidedBy: null,
    createdAt: "2026-10-20T00:00:00.000Z",
}

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentBrandProposalsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ContentBrandProposalsService)
}

describe("ContentBrandProposalsService", () => {
    it("stores a proposal with a bounded file name, or answers null", async () => {
        const em = mockEntityManager({
            query: [
                [INSERT_BRAND_PROPOSAL, [ROW]],
                [INSERT_BRAND_PROPOSAL, []],
            ],
        })
        const service = await build(em)
        const input = {
            workspaceId: "ws-1",
            installationId: "inst-1",
            setupSessionId: null,
            fileName: `${"a".repeat(300)}.pdf`,
            fileSize: 4,
            payload: "{}",
        }

        await expect(service.insert(input)).resolves.toEqual(RECORD)
        await expect(service.insert(input)).resolves.toBeNull()
        expect(em.query.mock.calls[0]?.[1]?.[3]).toHaveLength(255)
    })

    it("finds one proposal or null and lists an installation's proposals", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_BRAND_PROPOSAL, [ROW]],
                [FIND_BRAND_PROPOSAL, []],
                [LIST_BRAND_PROPOSALS, [ROW]],
            ],
        })
        const service = await build(em)

        await expect(service.find("ws-1", "p-1")).resolves.toEqual(RECORD)
        await expect(service.find("ws-1", "p-1")).resolves.toBeNull()
        await expect(service.list("ws-1", "inst-1")).resolves.toEqual([RECORD])
    })

    it("closes a waiting proposal, null when decided already", async () => {
        const em = mockEntityManager({
            query: [
                [CLOSE_BRAND_PROPOSAL, [{ ...ROW, status: "applied", decided_by: "Mai" }]],
                [CLOSE_BRAND_PROPOSAL, []],
            ],
        })
        const service = await build(em)
        const closing: BrandProposalClosing = { status: "applied", payload: "{}", decidedBy: "Mai" }

        await expect(service.close("ws-1", "p-1", closing)).resolves.toMatchObject({
            status: "applied",
            decidedBy: "Mai",
        })
        await expect(service.close("ws-1", "p-1", closing)).resolves.toBeNull()
        expect(em.query).toHaveBeenCalledWith(CLOSE_BRAND_PROPOSAL, ["ws-1", "p-1", "applied", "{}", "Mai"])
    })
})
