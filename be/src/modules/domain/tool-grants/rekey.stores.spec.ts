import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ToolGrantsService } from "./tool-grants.service"
import { ToolGrantEntity } from "./persistence/entities"

// The store half of the re-key: each store renames an id in place and keeps every other member of the row; where the holder already
// holds the new id, that row is kept as it is and the old one goes.

const AT = new Date("2026-11-12T03:00:00.000Z")

/** An id from its segments: a retired or malformed id is named on purpose here, never written whole. */
const dotted = (...segments: ReadonlyArray<string>): string => segments.join(".")
/** The re-key targets of this spec: ids of a retired namespace, as a re-key of the second flip wrote them. */
const NW_FIND = dotted("nivo-web", "customer", "find")
const NW_TICKET = dotted("nivo-web", "ticket", "get")
const MOVES = [
    { from: "crm.customer.find", to: NW_FIND },
    { from: "crm.ticket.get", to: NW_TICKET },
]

describe("ToolGrantsService.rekeyTools", () => {
    const grantOf = builder<ToolGrantEntity>({
        id: "grant-1",
        workspaceId: "ws-1",
        agentId: "agent-1",
        tool: "crm.customer.find",
        mode: "ask",
        limitVnd: null,
        constraints: [],
        updatedBy: "member-owner",
        createdAt: AT,
        updatedAt: AT,
    })

    it("renames the tool of a grant row and keeps its mode; a row already held under the new name wins", async () => {
        const entityManager = mockEntityManager({
            delete: [ToolGrantEntity, { affected: 1 }],
            update: [ToolGrantEntity, { affected: 1 }],
        })
        entityManager.find
            .mockResolvedValueOnce([grantOf(), grantOf({ id: "grant-2", agentId: "agent-2" })])
            .mockResolvedValueOnce([grantOf({ id: "grant-3", agentId: "agent-2", tool: NW_FIND, mode: "auto" })])
        fakeTransaction(entityManager)
        const moduleRef = await Test.createTestingModule({
            providers: [
                ToolGrantsService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
                { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            ],
        }).compile()

        const outcome = await moduleRef.get(ToolGrantsService).rekeyTools("ws-1", MOVES)

        expect(outcome).toEqual({ rekeyed: 1, merged: 1 })
        expect(entityManager.update.mock.calls.map((call): [unknown, unknown] => [call[1], call[2]])).toEqual([[{ id: "grant-1" }, { tool: NW_FIND }]])
        expect(entityManager.delete).toHaveBeenCalledTimes(1)
    })
})
