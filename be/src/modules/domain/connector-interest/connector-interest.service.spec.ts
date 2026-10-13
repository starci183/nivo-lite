import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectorInterestService } from "./connector-interest.service"
import { INSERT_CONNECTOR_INTEREST } from "./persistence/connector-interest.sql"

describe("ConnectorInterestService", () => {
    it("notes the wish of the workspace and its person", async () => {
        const em = mockEntityManager({ query: [INSERT_CONNECTOR_INTEREST, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [ConnectorInterestService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(ConnectorInterestService).note("ws-1", "shopee", "user-1")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(INSERT_CONNECTOR_INTEREST, ["ws-1", "shopee", "user-1"])
    })
})
