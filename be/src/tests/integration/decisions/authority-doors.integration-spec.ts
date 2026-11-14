import { persistGraphTenant, type GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { ListApproversQuery } from "../../../features/api/decisions/application/list-approvers.query"
import { ListApproversHandler } from "../../../features/api/decisions/application/list-approvers.handler"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useSeedConnection } from "../../world/sales-door-world.service"
import { useTestWorld } from "../../world/use-test-world"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)

const who: GraphTenant = { workspaceId: world.id(), userId: world.id(), agentId: world.id(), versionId: world.id() }
const OUTSIDER = world.id()
const principal = (id: string) => ({ id, role: "authenticated" as const })

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId])
    })
})

describe("the governance doors, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("answers the owner an empty approver list (approver groups are gone with the authority rules), and refuses a stranger", async () => {
        const approvers = world.resolve(ListApproversHandler)
        const members = await approvers.execute(
            new ListApproversQuery({ request: { workspaceId: who.workspaceId }, principal: principal(who.userId) }),
        )
        expect(members).toEqual([])
        await expect(
            approvers.execute(
                new ListApproversQuery({ request: { workspaceId: who.workspaceId }, principal: principal(OUTSIDER) }),
            ),
        ).rejects.toBeDefined()
    })
})
