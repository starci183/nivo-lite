import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { ConnectorInterestService } from "./connector-interest.service"
import { ConnectorInterestEntity } from "./persistence/entities"

describe("ConnectorInterestService", () => {
    it("notes the wish of the workspace and its person", async () => {
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [{ execute: {} }])
        const moduleRef = await Test.createTestingModule({
            providers: [ConnectorInterestService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(ConnectorInterestService).note("ws-1", "shopee", "user-1")).resolves.toBeUndefined()

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ConnectorInterestEntity, "ci")
        expect(insert?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", connectorId: "shopee", userId: "user-1" }]])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(insert?.callsOf("execute")).toHaveLength(1)
    })
})
