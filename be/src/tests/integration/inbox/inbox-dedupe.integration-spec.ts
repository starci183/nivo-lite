import { ToolReceiptsService, type ToolCallResult } from "@modules/domain/tool-receipts"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"
import { cleanGatewayClaims } from "../../world/inbox-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"

// The two cases that drove a write through a loopback REMOTE MCP server (registerRemote + approveCatalog) left with inbound MCP
// (owner's decision: the engine reaches its tools directly). The durable receipt below is the same for every tool family.
const world = useTestWorld({ modules: API_APP_MODULES })
const identity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId

beforeAll(async () => {
    world.cleanup(async () => {
        await cleanGatewayClaims(world.db.primary, WS)
        await removeWorkspace(world.db.primary, WS)
        await removeAuthUsers(world.db.primary, Object.values(identity.users))
    })
    await world.db.primary.transaction(async (tx) => {
        await persistOfficeRows(tx, identity)
    })
})

describe("durable write dedupe on the migrated local database", () => {
    it("keeps pending intent after an operation crashes and refuses to issue that operation again", async () => {
        const receipts = world.resolve(ToolReceiptsService)
        const key = world.key("hakuen-crash")
        const failure = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        const operation = jest.fn<Promise<ToolCallResult>, []>().mockRejectedValue(failure)
        await expect(receipts.run(WS, key, operation)).rejects.toBe(failure)
        await expect(receipts.run(WS, key, operation)).resolves.toEqual({
            ok: false,
            code: "unknown_outcome",
            detail: "operation_pending",
        })
        expect(operation).toHaveBeenCalledTimes(1)
    })
})
