import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EntitiesApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { WorkspaceTimeZoneService } from "./workspace-time-zone.service"

const pageOf = (data: Readonly<Record<string, unknown>> | null): ListPage => ({
    rows:
        data === null
            ? []
            : [
                  {
                      row: {
                          id: "s1",
                          workspaceId: "w1",
                          version: "1",
                          createdAt: "",
                          updatedAt: "",
                          data,
                      } satisfies RecordRow,
                      joined: {},
                      position: [],
                      included: {},
                  },
              ],
    next: null,
})

const build = async (page: ListPage) => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const api = mock<EntitiesApi>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    ports.entitiesApi.mockReturnValue(api)
    api.list.mockResolvedValue(page)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceTimeZoneService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceTimeZoneService), engine, api }
}

describe("WorkspaceTimeZoneService", () => {
    it("answers the time zone the workspace saved, read in the workspace's own scope", async () => {
        const { service, engine, api } = await build(pageOf({ key: "workspace", timeZone: "Asia/Bangkok" }))
        await expect(service.timeZoneOf("w1")).resolves.toBe("Asia/Bangkok")
        expect(engine.scoped.mock.calls[0]?.[0]).toBe("w1")
        expect(api.list.mock.calls[0]?.[0]).toMatchObject({ from: "workspace.settings" })
    })

    it("answers Asia/Ho_Chi_Minh until the workspace saved one, or when the saved name is not a zone", async () => {
        const none = await build(pageOf(null))
        await expect(none.service.timeZoneOf("w1")).resolves.toBe("Asia/Ho_Chi_Minh")
        const bad = await build(pageOf({ key: "workspace", timeZone: "Mars/Olympus" }))
        await expect(bad.service.timeZoneOf("w1")).resolves.toBe("Asia/Ho_Chi_Minh")
    })
})
