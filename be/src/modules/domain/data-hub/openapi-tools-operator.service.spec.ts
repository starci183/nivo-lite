import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { pinViewOf } from "@tests/fixtures/builders/openapi-tools-pin.builder"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { DataHubLogEvent } from "./data-hub.log-events"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { OpenApiToolsOperatorService, type OperatorPinRequest } from "./openapi-tools-operator.service"
import { OpenApiToolsPinService } from "./openapi-tools-pin.service"

const OWNER = { principalId: "owner-1", workspaceId: "workspace-1" }

const REQUEST: OperatorPinRequest = {
    workspaceId: "workspace-1",
    connectionId: "connection-1",
    connector: "crm.acme",
    swaggerUrl: "https://crm.example.test/v1/openapi.json",
    workspaceHeader: "X-Workspace-Id",
    documentText: '{"openapi":"3.0.3","paths":{}}',
    live: false,
}

const DRAFT = {
    connectionId: "connection-1",
    connector: "crm.acme",
    swaggerUrl: "https://crm.example.test/v1/openapi.json",
    workspaceHeader: "X-Workspace-Id",
    documentText: REQUEST.documentText,
    live: false,
}

/** The operator over doubles: the workspace has an owner, the pin plans as changed (or not) and pins. */
const build = async (changed = true) => {
    const pins = mock<OpenApiToolsPinService>()
    const members = mock<WorkspaceMemberDirectoryService>()
    const logger = mock<Logger>()
    const written: Array<string> = []
    members.firstActiveOwnerUserId.mockResolvedValue("owner-1")
    pins.plan.mockResolvedValue({ view: pinViewOf(), changed })
    pins.pin.mockResolvedValue(pinViewOf())
    pins.view.mockResolvedValue(pinViewOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            OpenApiToolsOperatorService,
            { provide: OpenApiToolsPinService, useValue: pins },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    const out = { write: (text: string) => written.push(text) }
    return { operator: moduleRef.get(OpenApiToolsOperatorService), pins, members, logger, out, written }
}

describe("OpenApiToolsOperatorService.pin", () => {
    it("is dry by default: it plans as the oldest active owner, prints the report, writes nothing and logs nothing", async () => {
        const { operator, pins, members, logger, out, written } = await build()

        await operator.pin(out, REQUEST)

        expect(members.firstActiveOwnerUserId).toHaveBeenCalledWith("workspace-1")
        expect(pins.plan).toHaveBeenCalledWith(OWNER, DRAFT)
        expect(pins.pin).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
        expect(written).toEqual([
            "openapi pin: DRY, would pin (run again with --execute)\n",
            "connector crm.acme, workspace header X-Workspace-Id, live false\n",
            `document sha256 ${pinViewOf().documentSha256}\n`,
            "tools 2: ready 2, missing 0, unsupported 0, mode_mismatch 0; customer audience 1\n",
            "  ready nivo.api.crm.acme.get.customers.code GET /v1/customers/{code} effect=unmarked audience=customer(code)\n",
            "  ready nivo.api.crm.acme.post.tickets POST /v1/tickets effect=unmarked audience=internal\n",
        ])
    })

    it("pins with --execute and records one event with who, the account, the sha256 and the counts", async () => {
        const { operator, pins, logger, out, written } = await build()

        await operator.pin(out, { ...REQUEST, execute: true })

        expect(pins.pin).toHaveBeenCalledWith(OWNER, DRAFT)
        expect(written[0]).toBe("openapi pin: EXECUTED, pinned\n")
        expect(logger.info).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith(DataHubLogEvent.OpenApiPinned, {
            workspaceId: "workspace-1",
            connectionId: "connection-1",
            actor: "owner-1",
            via: "cli",
            connector: "crm.acme",
            documentSha256: pinViewOf().documentSha256,
            live: false,
            changed: true,
            ready: 2,
            missing: 0,
            unsupported: 0,
            modeMismatch: 0,
            customerAudience: 1,
        })
    })

    it("says so when the pin is already in force, dry and executed, and records that nothing changed", async () => {
        const { operator, logger, out, written } = await build(false)

        await operator.pin(out, REQUEST)
        await operator.pin(out, { ...REQUEST, execute: true })

        expect(written.filter((line) => line.startsWith("openapi pin:"))).toEqual([
            "openapi pin: DRY, already pinned, would change nothing\n",
            "openapi pin: EXECUTED, already pinned, nothing written\n",
        ])
        expect(logger.info).toHaveBeenCalledWith(
            DataHubLogEvent.OpenApiPinned,
            expect.objectContaining({ changed: false }),
        )
    })
})

describe("OpenApiToolsOperatorService.pin refusals", () => {
    it.each(["crm_id_invalid", "connector_taken"])(
        "says a refusal (%s) on the output, pins nothing and fails",
        async (detail) => {
            const { operator, pins, logger, out, written } = await build()
            const refused = new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })
            pins.plan.mockRejectedValue(refused)

            await expect(operator.pin(out, { ...REQUEST, execute: true })).rejects.toBe(refused)

            expect(written).toEqual([`openapi pin: REFUSED (${detail}); nothing written\n`])
            expect(pins.pin).not.toHaveBeenCalled()
            expect(logger.info).not.toHaveBeenCalled()
        },
    )

    it("acts for no workspace that has no active owner", async () => {
        const { operator, pins, members, out } = await build()
        members.firstActiveOwnerUserId.mockResolvedValue(null)

        await expect(operator.pin(out, REQUEST)).rejects.toMatchObject({ code: DataHubErrorCode.NotFound })
        expect(pins.plan).not.toHaveBeenCalled()
    })
})

describe("OpenApiToolsOperatorService.view", () => {
    it("prints what the account serves now, or that it pinned no document", async () => {
        const pinned = await build()
        const bare = await build()
        bare.pins.view.mockResolvedValue(null)

        await pinned.operator.view(pinned.out, { workspaceId: "workspace-1", connectionId: "connection-1" })
        await bare.operator.view(bare.out, { workspaceId: "workspace-1", connectionId: "connection-1" })

        expect(pinned.pins.view).toHaveBeenCalledWith(OWNER, "connection-1")
        expect(pinned.written[0]).toBe(`openapi pin-view: pinned at ${pinViewOf().pinnedAt}\n`)
        expect(pinned.written).toHaveLength(6)
        expect(bare.written).toEqual(["openapi pin-view: no document is pinned on this account; it serves no tool\n"])
    })
})
