import assert from "node:assert/strict"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { persistGraphTenant, type GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { ListApproversQuery } from "../../../features/api/decisions/application/list-approvers.query"
import { ListApproversHandler } from "../../../features/api/decisions/application/list-approvers.handler"
import { ListMemberGrantsQuery } from "../../../features/api/decisions/application/list-member-grants.query"
import { ListMemberGrantsHandler } from "../../../features/api/decisions/application/list-member-grants.handler"
import { ReadAuthorityQuery } from "../../../features/api/decisions/application/read-authority.query"
import { ReadAuthorityHandler } from "../../../features/api/decisions/application/read-authority.handler"
import { SaveMemberGrantsCommand } from "../../../features/api/decisions/application/save-member-grants.command"
import { SaveMemberGrantsHandler } from "../../../features/api/decisions/application/save-member-grants.handler"
import { SaveRuleCommand } from "../../../features/api/decisions/application/save-rule.command"
import { SaveRuleHandler } from "../../../features/api/decisions/application/save-rule.handler"
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

const actionKey = async (): Promise<string> => {
    const [first] = await world.resolve(AuthorityActionsService).list(world.db.primary)
    assert(first !== undefined, "The registry holds at least one authority action")
    return first.action
}

describe("the governance doors, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("lists the people who may be approvers for the owner, and refuses a stranger", async () => {
        const approvers = world.resolve(ListApproversHandler)
        const members = await approvers.execute(
            new ListApproversQuery({ request: { workspaceId: who.workspaceId }, principal: principal(who.userId) }),
        )
        expect(members.length).toBeGreaterThan(0)
        await expect(
            approvers.execute(
                new ListApproversQuery({ request: { workspaceId: who.workspaceId }, principal: principal(OUTSIDER) }),
            ),
        ).rejects.toBeDefined()
    })

    it("saves the rule of an action and reads it back on the authority sheet of the workspace", async () => {
        const action = await actionKey()
        const saved = await world.resolve(SaveRuleHandler).execute(
            new SaveRuleCommand({
                request: {
                    workspaceId: who.workspaceId,
                    change: {
                        action,
                        department: "accounting",
                        mode: "ask",
                        limit_vnd: null,
                        required_fields: [],
                        note: "by owner",
                    },
                },
                principal: principal(who.userId),
            }),
        )
        expect(saved).toMatchObject({ action, mode: "ask", workspace_id: who.workspaceId })
        const sheet = await world
            .resolve(ReadAuthorityHandler)
            .execute(
                new ReadAuthorityQuery({ request: { workspaceId: who.workspaceId }, principal: principal(who.userId) }),
            )
        expect(sheet.rules.map((rule) => rule.action)).toContain(action)
    })

    it("saves the approval limits of an action for the owner and lists them, and none leave the workspace", async () => {
        const action = await actionKey()
        const memberId = (
            await world.resolve(ListApproversHandler).execute(
                new ListApproversQuery({
                    request: { workspaceId: who.workspaceId },
                    principal: principal(who.userId),
                }),
            )
        )[0]?.memberId
        assert(memberId !== undefined, "The workspace has its owner as a member")
        await world.resolve(SaveMemberGrantsHandler).execute(
            new SaveMemberGrantsCommand({
                request: { workspaceId: who.workspaceId, action, grants: [{ memberId, maxAmount: 1_000_000 }] },
                principal: principal(who.userId),
            }),
        )
        const listed = await world.resolve(ListMemberGrantsHandler).execute(
            new ListMemberGrantsQuery({
                request: { workspaceId: who.workspaceId, action },
                principal: principal(who.userId),
            }),
        )
        expect(listed.map((grant) => [grant.member_id, grant.max_amount])).toEqual([[memberId, 1_000_000]])
    })
})
