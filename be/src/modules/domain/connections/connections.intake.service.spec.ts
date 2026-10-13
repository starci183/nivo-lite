import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MODULE_OPTIONS_TOKEN } from "./connections.module-definition"
import { ConnectionsService } from "./connections.service"
import { ConnectionsErrorCode } from "./errors/connections.error"
import {
    APPLY_ZALO_AUTHORIZATION,
    FIND_INTAKE_CONNECTION,
    LIST_HEALTH_BATCH,
    MARK_CONNECTION_ERROR,
    MARK_CONNECTION_HEALTH,
    MARK_CONNECTION_RECEIVED,
} from "./persistence/connections.sql"

const build = async (
    found: ReadonlyArray<unknown> = [{ id: "c-1", workspace_id: "ws-1", status: "connected" }],
    batch: ReadonlyArray<unknown> = [],
) => {
    const em = mockEntityManager({
        query: [
            [FIND_INTAKE_CONNECTION, found],
            [MARK_CONNECTION_ERROR, []],
            [MARK_CONNECTION_RECEIVED, []],
            [APPLY_ZALO_AUTHORIZATION, []],
            [LIST_HEALTH_BATCH, batch],
            [MARK_CONNECTION_HEALTH, []],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            {
                provide: MODULE_OPTIONS_TOKEN,
                useValue: {
                    channelTokenKey: new Secret(Buffer.alloc(32, 1).toString("base64")),
                    publicSiteUrl: undefined,
                },
            },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionsService), em }
}

describe("ConnectionsService", () => {
    describe("intakeOf", () => {
        it("answers the connection of the provider with its workspace and status", async () => {
            const { service, em } = await build()

            await expect(service.intakeOf("c-1", "telegram")).resolves.toEqual({
                kind: "ok",
                value: { id: "c-1", workspaceId: "ws-1", status: "connected" },
            })
            expect(em.query).toHaveBeenCalledWith(FIND_INTAKE_CONNECTION, ["c-1", "telegram"])
        })

        it("reads through the transaction manager it is given", async () => {
            const { service, em } = await build([])
            const inside = mockEntityManager({
                query: [FIND_INTAKE_CONNECTION, [{ id: "c-2", workspace_id: "ws-1", status: "pending" }]],
            })

            await expect(service.intakeOf("c-2", "zalo_oa", inside)).resolves.toEqual({
                kind: "ok",
                value: { id: "c-2", workspaceId: "ws-1", status: "pending" },
            })
            expect(inside.query).toHaveBeenCalledTimes(1)
            expect(inside.query).toHaveBeenCalledWith(FIND_INTAKE_CONNECTION, ["c-2", "zalo_oa"])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a connection that is missing, disconnected or of another provider", async () => {
            const { service, em } = await build([])

            await expect(service.intakeOf("c-1", "telegram")).resolves.toEqual({
                kind: "refused",
                code: ConnectionsErrorCode.NotFound,
                params: undefined,
            })
            expect(em.query).toHaveBeenCalledWith(FIND_INTAKE_CONNECTION, ["c-1", "telegram"])
        })
    })

    describe("writes", () => {
        it("marks a connection failing with its reason", async () => {
            const { service, em } = await build()

            await expect(service.markFailing("c-1", "Reconnect")).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(MARK_CONNECTION_ERROR, ["c-1", "Reconnect"])
        })

        it("records the first event through the transaction manager", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({ query: [MARK_CONNECTION_RECEIVED, []] })

            await expect(
                service.markReceived(
                    "c-1",
                    {
                        amount: 0,
                        content: "Minh",
                        at: "2026-10-12T10:00:00.000Z",
                        text: "Hi",
                    },
                    inside,
                ),
            ).resolves.toBeUndefined()

            expect(inside.query).toHaveBeenCalledWith(MARK_CONNECTION_RECEIVED, [
                "c-1",
                '{"amount":0,"content":"Minh","at":"2026-10-12T10:00:00.000Z","text":"Hi"}',
            ])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("applies a Zalo authorization with or without the OA id", async () => {
            const { service, em } = await build()

            await expect(service.applyZaloAuthorization("c-1", "oa-9")).resolves.toBeUndefined()
            await expect(service.applyZaloAuthorization("c-1")).resolves.toBeUndefined()

            expect(em.query).toHaveBeenNthCalledWith(1, APPLY_ZALO_AUTHORIZATION, [
                "c-1",
                '{"authorized":true,"oa_id":"oa-9"}',
            ])
            expect(em.query).toHaveBeenNthCalledWith(2, APPLY_ZALO_AUTHORIZATION, ["c-1", '{"authorized":true}'])
        })
    })

    describe("health", () => {
        const row = {
            id: "c-1",
            workspace_id: "ws-1",
            provider: "telegram",
            name: "Bot",
            status: "connected",
            last_error: "",
            last_event_at: "2026-10-10 10:00:00+00",
            created_at: "2026-10-01 10:00:00+00",
            health: "ok",
        }

        it("reads a page of connections after an id, from the start when none is given", async () => {
            const { service, em } = await build([], [row])
            const expected = [
                {
                    id: "c-1",
                    workspaceId: "ws-1",
                    provider: "telegram",
                    name: "Bot",
                    status: "connected",
                    lastError: "",
                    lastEventAt: "2026-10-10 10:00:00+00",
                    createdAt: "2026-10-01 10:00:00+00",
                    health: "ok",
                },
            ]

            await expect(service.healthBatch("", 100)).resolves.toEqual(expected)
            await expect(service.healthBatch("c-1", 100)).resolves.toEqual(expected)

            expect(em.query).toHaveBeenNthCalledWith(1, LIST_HEALTH_BATCH, [
                "00000000-0000-0000-0000-000000000000",
                100,
            ])
            expect(em.query).toHaveBeenNthCalledWith(2, LIST_HEALTH_BATCH, ["c-1", 100])
        })

        it("records the verdict in the public facts", async () => {
            const { service, em } = await build()

            await expect(
                service.markHealth("c-1", {
                    state: "silent",
                    reason: "no event for 80h",
                    checkedAt: "2026-10-12T10:00:00.000Z",
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(MARK_CONNECTION_HEALTH, [
                "c-1",
                '{"state":"silent","reason":"no event for 80h","checked_at":"2026-10-12T10:00:00.000Z"}',
            ])
        })
    })
})
