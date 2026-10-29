import { Test } from "@nestjs/testing"
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ErrorsService } from "@modules/platform/errors"
import { ERRORS_SERVICE } from "@modules/platform/errors"
import { namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import { ConnectionCommandsService } from "./connection-commands.service"
import { ConnectionCommandEntity } from "./persistence/entities"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const itemsLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining(items)

const CONNECTION_ID = "00000000-0000-0000-0000-000000000001"
const row: ConnectionCommandEntity = {
    id: "command-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    kind: "connection.first-event",
    input: { connectionId: CONNECTION_ID },
    status: "pending",
    outcome: null,
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
    finishedAt: null,
}
const actor = { principalId: "user-1", workspaceId: "workspace-1" }

const build = async (entityManager: MockEntityManager) => {
    const errors = mock<ErrorsService>()
    const connections = mock<ConnectionsService>()
    const grants = mock<ConnectionGrantsService>()
    const channels = mock<ChannelConnectionsService>()
    const webhooks = mock<WebhookConnectionsService>()
    const google = mock<GoogleConnectionsService>()
    const meta = mock<MetaConnectionsService>()
    const lifecycle = mock<ConnectionLifecycleService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionCommandsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ERRORS_SERVICE, useValue: errors },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionGrantsService, useValue: grants },
            { provide: ChannelConnectionsService, useValue: channels },
            { provide: WebhookConnectionsService, useValue: webhooks },
            { provide: GoogleConnectionsService, useValue: google },
            { provide: MetaConnectionsService, useValue: meta },
            { provide: ConnectionLifecycleService, useValue: lifecycle },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionCommandsService), errors, connections }
}

describe("ConnectionCommandsService", () => {
    it("declares the platform errors service injection token", () => {
        const tokens: unknown = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ConnectionCommandsService)
        expect(tokens).toEqual(itemsLike([objectLike({ index: 1, param: ERRORS_SERVICE })]))
    })

    it("leaves an unknown command untouched", async () => {
        const entityManager = mockEntityManager({ findOne: [ConnectionCommandEntity, null] })
        const { service, connections, errors } = await build(entityManager)

        await expect(service.run("unknown-command")).resolves.toBeUndefined()

        expect(namedCalls(entityManager.findOne.mock.calls)).toEqual([
            ["ConnectionCommandEntity", { where: { id: "unknown-command" } }],
        ])
        expect(connections.firstEvent).not.toHaveBeenCalled()
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("runs the command a claimed job payload names", async () => {
        const entityManager = mockEntityManager({ findOne: [ConnectionCommandEntity, null] })
        const { service } = await build(entityManager)

        await service.runPayload({ commandId: "command-9", workspaceId: "workspace-1" })

        expect(namedCalls(entityManager.findOne.mock.calls)).toEqual([
            ["ConnectionCommandEntity", { where: { id: "command-9" } }],
        ])
    })

    it("leaves a claimed job payload that names no command alone", async () => {
        const entityManager = mockEntityManager({ findOne: [ConnectionCommandEntity, null] })
        const { service } = await build(entityManager)

        await expect(service.runPayload({ workspaceId: "workspace-1" })).resolves.toBeUndefined()

        expect(entityManager.findOne).not.toHaveBeenCalled()
    })

    it("does not run a command that is already done", async () => {
        const entityManager = mockEntityManager({ findOne: [ConnectionCommandEntity, { ...row, status: "done" }] })
        const { service, connections, errors } = await build(entityManager)

        await expect(service.run("command-1")).resolves.toBeUndefined()

        expect(namedCalls(entityManager.findOne.mock.calls)).toEqual([
            ["ConnectionCommandEntity", { where: { id: "command-1" } }],
        ])
        expect(connections.firstEvent).not.toHaveBeenCalled()
        expect(errors.describe).not.toHaveBeenCalled()
    })
})

describe("ConnectionCommandsService", () => {
    it("runs a pending command as its member and writes its successful answer as JSON", async () => {
        const entityManager = mockEntityManager({
            findOne: [ConnectionCommandEntity, row],
            update: [ConnectionCommandEntity, { affected: 1 }],
        })
        const { service, connections, errors } = await build(entityManager)
        connections.firstEvent.mockResolvedValue({
            status: "connected",
            firstEvent: { amount: 75000, content: "invoice-7", at: "2026-10-13T02:00:00.000Z" },
        })

        await expect(service.run("command-1")).resolves.toBeUndefined()

        expect(connections.firstEvent.mock.calls).toEqual([[actor, CONNECTION_ID]])
        expect(namedCalls(entityManager.update.mock.calls, 2)).toEqual([
            [
                "ConnectionCommandEntity",
                { id: "command-1", status: "pending" },
                {
                    status: "done",
                    outcome: {
                        ok: true,
                        value: {
                            status: "connected",
                            firstEvent: { amount: 75000, content: "invoice-7", at: "2026-10-13T02:00:00.000Z" },
                        },
                    },
                    finishedAt: "function",
                },
            ],
        ])
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("describes a DomainError and writes exactly its kind, code and params as the failed outcome", async () => {
        const entityManager = mockEntityManager({
            findOne: [ConnectionCommandEntity, row],
            update: [ConnectionCommandEntity, { affected: 1 }],
        })
        const { service, connections, errors } = await build(entityManager)
        const error = new ConnectionsError({
            code: ConnectionsErrorCode.NotFound,
            params: { connectionId: CONNECTION_ID },
        })
        connections.firstEvent.mockRejectedValue(error)
        errors.describe.mockReturnValue({
            kind: "not-found",
            code: "CONNECTIONS_NOT_FOUND",
            params: { connectionId: CONNECTION_ID },
            status: 404,
        })

        await expect(service.run("command-1")).resolves.toBeUndefined()

        expect(connections.firstEvent.mock.calls).toEqual([[actor, CONNECTION_ID]])
        expect(errors.describe.mock.calls).toEqual([[error]])
        expect(namedCalls(entityManager.update.mock.calls, 2)).toEqual([
            [
                "ConnectionCommandEntity",
                { id: "command-1", status: "pending" },
                {
                    status: "done",
                    outcome: {
                        ok: false,
                        kind: "not-found",
                        code: "CONNECTIONS_NOT_FOUND",
                        params: { connectionId: CONNECTION_ID },
                    },
                    finishedAt: "function",
                },
            ],
        ])
    })
})
