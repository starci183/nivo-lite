import { Test } from "@nestjs/testing"
import { keyOf } from "@tests/fixtures/builders/api-keys.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { installedChatFrontDoors } from "@modules/domain/installed-plugins"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApiKeyOwnerService } from "./api-key-owner.service"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import { ApiKeyEntity } from "./persistence/entities"

type FoundAgent = NonNullable<Awaited<ReturnType<AgentDirectoryService["find"]>>>

const SCOPED = "agent-scoped"
const FRONT = "agent-front"
const PUBLIC_SCOPES = ["messages:write"]

/** The customer-chat front doors the installation names, best first: a company's own template (a private plugin's), then the shared chatbot. */
const FRONT_MODULES = installedChatFrontDoors()
const [OWN_MODULE, SHARED_MODULE] = FRONT_MODULES

const build = async (
    entityManager: MockEntityManager,
    held: ReadonlyArray<string>,
    frontModules: ReadonlyArray<string> = [],
) => {
    const directory = mock<AgentDirectoryService>()
    directory.find.mockImplementation((_workspace, agentId) =>
        Promise.resolve(held.includes(agentId) ? mock<FoundAgent>({ id: agentId }) : null),
    )
    directory.firstActiveIdOfModule.mockImplementation((_workspace, module) =>
        Promise.resolve(frontModules.includes(module) ? FRONT : null),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKeyOwnerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: directory },
        ],
    }).compile()
    return { owners: moduleRef.get(ApiKeyOwnerService), directory }
}

const keyAnswer = (overrides: Partial<ApiKeyEntity>) =>
    mockEntityManager({ findOne: [ApiKeyEntity, keyOf({ scopes: PUBLIC_SCOPES, ...overrides })] })

describe("ApiKeyOwnerService", () => {
    it("names the agent the key is scoped to, without looking at the front door", async () => {
        const { owners, directory } = await build(keyAnswer({ agentId: SCOPED }), [SCOPED], [SHARED_MODULE ?? ""])
        await expect(owners.agentOfKey("ws-1", "key-2")).resolves.toBe(SCOPED)
        expect(directory.firstActiveIdOfModule).not.toHaveBeenCalled()
    })

    it("names the workspace's installed customer-chat front door for an unscoped key, read from the installation (the chatbot for an ordinary workspace)", async () => {
        const { owners } = await build(keyAnswer({ agentId: null }), [], [SHARED_MODULE ?? ""])
        await expect(owners.agentOfKey("ws-1", "key-2")).resolves.toBe(FRONT)
        expect(SHARED_MODULE).toBe("chatbot")
    })

    it("prefers the company's own front door when the workspace holds both", async () => {
        const { owners, directory } = await build(
            keyAnswer({ agentId: null }),
            [],
            [OWN_MODULE ?? "", SHARED_MODULE ?? ""],
        )
        await expect(owners.agentOfKey("ws-1", "key-2")).resolves.toBe(FRONT)
        expect(directory.firstActiveIdOfModule).toHaveBeenCalledTimes(1)
    })

    it("falls to the front door when the scoped agent is gone from the workspace", async () => {
        const { owners } = await build(keyAnswer({ agentId: SCOPED }), [], [SHARED_MODULE ?? ""])
        await expect(owners.agentOfKey("ws-1", "key-2")).resolves.toBe(FRONT)
    })

    it("refuses a key with no scope that holds and no front door installed", async () => {
        const { owners } = await build(keyAnswer({ agentId: SCOPED }), [], [])
        await expect(owners.agentOfKey("ws-1", "key-2")).rejects.toMatchObject({ code: ApiKeysErrorCode.AgentMissing })
    })

    it("answers null for an id that is no public API key of the workspace (another entrance's id, an MCP key)", async () => {
        const missing = await build(mockEntityManager({ findOne: [ApiKeyEntity, null] }), [], [SHARED_MODULE ?? ""])
        await expect(missing.owners.agentOfKey("ws-1", "site-1")).resolves.toBeNull()
        const mcp = await build(keyAnswer({ scopes: ["mcp"], agentId: SCOPED }), [SCOPED], [SHARED_MODULE ?? ""])
        await expect(mcp.owners.agentOfKey("ws-1", "key-2")).resolves.toBeNull()
    })
})
