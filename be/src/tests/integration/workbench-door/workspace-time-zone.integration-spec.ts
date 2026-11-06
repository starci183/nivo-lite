import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { SceneWorkspace } from "../../fixtures/builders/accounting-scene.builder"
import { currentRole } from "../../world/backend-role-sandbox.service"
import { zoneReaderOf } from "../../world/workspace-time-zone-world.service"
import { useTestWorld } from "../../world/use-test-world"
import { backendSandbox, workbenchDoorProofModules } from "../../world/workbench-door-proof.module"
import { useDoorProof } from "../../world/workbench-door-proof.service"

jest.setTimeout(240_000)

const world = useTestWorld({ modules: workbenchDoorProofModules(), sandbox: backendSandbox })
const proof = useDoorProof(world)

const openWorkspace = async (): Promise<SceneWorkspace> => {
    const workspace: SceneWorkspace = { workspaceId: world.id(), userId: world.id() }
    await proof.persistWorkspace(workspace)
    return workspace
}

const saveZone = async (workspace: SceneWorkspace, timeZone: string): Promise<void> => {
    const engine = world.resolve(EntityEngineService)
    const api = world
        .resolve(EntityPortsService)
        .entitiesApi((use) => engine.scoped(workspace.workspaceId, use), "action")
    const saved = await api.upsert("workspace.settings", "workspace_key", { key: "workspace", timeZone })
    expect(saved.ok).toBe(true)
}

describe("the workspace time zone, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("is Asia/Ho_Chi_Minh until the workspace saves one, then the one it saved, and one workspace never reads another's", async () => {
        const zones = zoneReaderOf(world)
        const mine = await openWorkspace()
        const other = await openWorkspace()
        await expect(zones.timeZoneOf(mine.workspaceId)).resolves.toBe("Asia/Ho_Chi_Minh")
        await saveZone(mine, "Asia/Bangkok")
        await expect(zones.timeZoneOf(mine.workspaceId)).resolves.toBe("Asia/Bangkok")
        await expect(zones.timeZoneOf(other.workspaceId)).resolves.toBe("Asia/Ho_Chi_Minh")
        await saveZone(mine, "Asia/Tokyo")
        await expect(zones.timeZoneOf(mine.workspaceId)).resolves.toBe("Asia/Tokyo")
    })
})
