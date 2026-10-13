import { strict as assert } from "node:assert"
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
import { ConnectionCommandsService } from "./connection-commands.service"
import type { ConnectionCommandRow } from "./persistence/connection-commands.rows"
import { FIND_COMMAND, FINISH_COMMAND } from "./persistence/connection-commands.sql"

// Read the actual injection token because the errors public entry exports only its decorator.
const injectionTokens: ReadonlyArray<{ readonly index: number; readonly param: typeof ERRORS_SERVICE }> =
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ConnectionCommandsService)
const errorsInjection = injectionTokens.find(({ index }) => index === 1)
assert.ok(errorsInjection, "ConnectionCommandsService must declare its errors injection token")
const ERRORS_SERVICE: unique symbol = errorsInjection.param

const CONNECTION_ID = "00000000-0000-0000-0000-000000000001"
const row: ConnectionCommandRow = {
    id: "command-1",
    workspace_id: "workspace-1",
    user_id: "user-1",
    kind: "connection.first-event",
    input: { connectionId: CONNECTION_ID },
    status: "pending",
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
    it("leaves an unknown command untouched", async () => {
        const entityManager = mockEntityManager({ query: [FIND_COMMAND, []] })
        const { service, connections, errors } = await build(entityManager)

        await expect(service.run("unknown-command")).resolves.toBeUndefined()

        expect(entityManager.query.mock.calls).toEqual([[FIND_COMMAND, ["unknown-command"]]])
        expect(connections.firstEvent).not.toHaveBeenCalled()
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("does not run a command that is already done", async () => {
        const entityManager = mockEntityManager({ query: [FIND_COMMAND, [{ ...row, status: "done" }]] })
        const { service, connections, errors } = await build(entityManager)

        await expect(service.run("command-1")).resolves.toBeUndefined()

        expect(entityManager.query.mock.calls).toEqual([[FIND_COMMAND, ["command-1"]]])
        expect(connections.firstEvent).not.toHaveBeenCalled()
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("runs a pending command as its member and writes its successful answer as JSON", async () => {
        const entityManager = mockEntityManager({
            query: [
                [FIND_COMMAND, [row]],
                [FINISH_COMMAND, [{ id: "command-1" }]],
            ],
        })
        const { service, connections, errors } = await build(entityManager)
        connections.firstEvent.mockResolvedValue({
            status: "connected",
            firstEvent: { amount: 75000, content: "invoice-7", at: "2026-10-13T02:00:00.000Z" },
        })

        await expect(service.run("command-1")).resolves.toBeUndefined()

        expect(connections.firstEvent.mock.calls).toEqual([[actor, CONNECTION_ID]])
        expect(entityManager.query.mock.calls).toEqual([
            [FIND_COMMAND, ["command-1"]],
            [
                FINISH_COMMAND,
                [
                    "command-1",
                    '{"ok":true,"value":{"status":"connected","firstEvent":{"amount":75000,"content":"invoice-7","at":"2026-10-13T02:00:00.000Z"}}}',
                ],
            ],
        ])
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("describes a DomainError and writes exactly its kind, code and params as the failed outcome", async () => {
        const entityManager = mockEntityManager({
            query: [
                [FIND_COMMAND, [row]],
                [FINISH_COMMAND, [{ id: "command-1" }]],
            ],
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
        expect(entityManager.query.mock.calls).toEqual([
            [FIND_COMMAND, ["command-1"]],
            [
                FINISH_COMMAND,
                [
                    "command-1",
                    '{"ok":false,"kind":"not-found","code":"CONNECTIONS_NOT_FOUND","params":{"connectionId":"00000000-0000-0000-0000-000000000001"}}',
                ],
            ],
        ])
    })
})
