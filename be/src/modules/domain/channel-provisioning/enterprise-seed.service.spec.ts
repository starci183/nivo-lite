import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { WorkspaceEnterpriseService, WorkspaceLobbyService, WorkspacesService } from "@modules/domain/workspaces"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import { ENTERPRISE_SEED_SCHEMA } from "./enterprise-seed.contracts"
import type { EnterpriseSeedTarget } from "./enterprise-seed.contracts"
import { EnterpriseSeedService } from "./enterprise-seed.service"
import { ENTERPRISE_ROSTER, type EnterpriseRoster } from "./enterprise-roster.port"

const documentOf = (target: EnterpriseSeedTarget) => ({
    schema: ENTERPRISE_SEED_SCHEMA,
    identifier: "nivo-web",
    target,
    workspaceName: "NIVO Web",
    ownerWorkspace: "NIVO",
})

const envelope = (target: EnterpriseSeedTarget): string =>
    `${JSON.stringify({ documents: [{ path: "data/enterprises/nivo-web.json", document: documentOf(target) }] })}\n`

const NIVO = { id: "ws-nivo", name: "NIVO" }
const WEB = { id: "ws-web", name: "NIVO Web" }

const build = async (
    named: ReadonlyArray<{ id: string; name: string }> = [NIVO],
    dead: ReadonlyArray<string> = [],
    roster?: EnterpriseRoster,
) => {
    const workspaces = mock<WorkspacesService>()
    workspaces.list.mockResolvedValue([...named])
    workspaces.isLive.mockImplementation((id) => Promise.resolve(!dead.includes(id)))
    workspaces.ownerIdOf.mockResolvedValue("owner-1")
    workspaces.ensureNamed.mockResolvedValue({ id: "ws-web" })
    const lobby = mock<WorkspaceLobbyService>()
    lobby.remove.mockResolvedValue(undefined)
    const enterprise = mock<WorkspaceEnterpriseService>()
    enterprise.set.mockResolvedValue({ from: null, to: "nivo-web" })
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EnterpriseSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceLobbyService, useValue: lobby },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
            ...(roster === undefined ? [] : [{ provide: ENTERPRISE_ROSTER, useValue: roster }]),
        ],
    }).compile()
    return { service: moduleRef.get(EnterpriseSeedService), workspaces, lobby, enterprise, print }
}

const PLAN =
    'nivo-web: remove on dev the workspace "NIVO Web" ws-web with everything in it, the foundation and all that was made while ' +
    "testing (conversations, runs, documents, records), through the owner's delete door: every seat disabled at once, its rows kept " +
    "until an operator prune"

afterEach(() => {
    jest.restoreAllMocks()
})

describe("EnterpriseSeedService > run, each target in each environment", () => {
    it.each([
        ["off", "dev", false],
        ["off", "production", false],
        ["local", "dev", true],
        ["local", "production", false],
        ["prod", "dev", false],
        ["prod", "production", true],
        ["both", "dev", true],
        ["both", "production", true],
    ] as const)("target %s on %s seeds: %s", async (target, environment, seeds) => {
        const { service, workspaces, enterprise, print } = await build()

        await service.run(envelope(target), environment)

        if (seeds) {
            expect(workspaces.ensureNamed).toHaveBeenCalledWith("owner-1", "NIVO Web")
            expect(enterprise.set).toHaveBeenCalledWith("ws-web", "nivo-web")
            expect(print.mock.calls).toEqual([
                ["nivo-web: workspace ws-web created"],
                ["nivo-web: enterprise identifier set"],
                ["applied"],
            ])
        } else {
            expect(workspaces.list).not.toHaveBeenCalled()
            expect(workspaces.ensureNamed).not.toHaveBeenCalled()
            expect(print.mock.calls).toEqual([
                [`nivo-web: target is ${target}: nothing seeded on ${environment}`],
                ["unchanged"],
            ])
        }
    })

    it("refuses an environment it does not know, before reading anything", async () => {
        const { service, workspaces } = await build()

        await expect(service.run(envelope("both"), "staging")).rejects.toMatchObject({ params: { field: "env" } })

        expect(workspaces.list).not.toHaveBeenCalled()
    })
})

describe("EnterpriseSeedService > run, the workspace", () => {
    it("keeps the workspace and the identifier it already holds and answers unchanged on a rerun", async () => {
        const { service, workspaces, enterprise, print } = await build([NIVO, WEB])
        enterprise.set.mockResolvedValue({ from: "nivo-web", to: "nivo-web" })

        await service.run(envelope("local"), "dev")

        expect(workspaces.ensureNamed).toHaveBeenCalledWith("owner-1", "NIVO Web")
        expect(print.mock.calls).toEqual([
            ["nivo-web: workspace ws-web kept"],
            ["nivo-web: enterprise identifier kept"],
            ["unchanged"],
        ])
    })

    it("answers applied when the held workspace still lacked its identifier", async () => {
        const { service, print } = await build([NIVO, WEB])

        await service.run(envelope("local"), "dev")

        expect(print.mock.calls).toEqual([
            ["nivo-web: workspace ws-web kept"],
            ["nivo-web: enterprise identifier set"],
            ["applied"],
        ])
    })

    it("does not count a deleted workspace of the same name, nor one another owner holds", async () => {
        const { service, workspaces, print } = await build(
            [NIVO, WEB, { id: "ws-other", name: "NIVO Web" }],
            ["ws-web"],
        )
        workspaces.ownerIdOf.mockImplementation((id) => Promise.resolve(id === "ws-other" ? "owner-2" : "owner-1"))

        await service.run(envelope("local"), "dev")

        expect(print.mock.calls).toEqual([
            ["nivo-web: workspace ws-web created"],
            ["nivo-web: enterprise identifier set"],
            ["applied"],
        ])
    })

    it("ensures the workspace, then stops when the enterprise identifier door refuses (another workspace holds it)", async () => {
        const { service, workspaces, enterprise, print } = await build()
        enterprise.set.mockRejectedValue(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "identifier" } }),
        )

        await expect(service.run(envelope("local"), "dev")).rejects.toMatchObject({ params: { field: "identifier" } })

        expect(workspaces.ensureNamed).toHaveBeenCalledWith("owner-1", "NIVO Web")
        expect(print.mock.calls).toEqual([["nivo-web: workspace ws-web created"]])
    })

    it.each([
        ["no live workspace has the owner's name", [], []],
        ["two live workspaces have the owner's name", [NIVO, { id: "ws-b", name: "NIVO" }], []],
        ["the only one of that name is deleted", [NIVO], ["ws-nivo"]],
    ])("refuses ownerWorkspace when %s, before writing", async (_case, named, dead) => {
        const { service, workspaces } = await build(named, dead)

        await expect(service.run(envelope("local"), "dev")).rejects.toThrow(ConnectionsError)

        expect(workspaces.ensureNamed).not.toHaveBeenCalled()
    })

    it("refuses ownerWorkspace when the owner's workspace has no owner", async () => {
        const { service, workspaces } = await build()
        workspaces.ownerIdOf.mockResolvedValue(null)

        await expect(service.run(envelope("local"), "dev")).rejects.toMatchObject({
            params: { field: "ownerWorkspace" },
        })

        expect(workspaces.ensureNamed).not.toHaveBeenCalled()
    })
})

describe("EnterpriseSeedService > remove", () => {
    it.each(["off", "local", "prod", "both"] as const)("never runs in production (target %s)", async (target) => {
        const { service, workspaces, lobby, print } = await build([NIVO, WEB])

        await expect(service.remove(envelope(target), "production", true)).rejects.toMatchObject({
            params: { field: "env" },
        })

        expect(workspaces.list).not.toHaveBeenCalled()
        expect(lobby.remove).not.toHaveBeenCalled()
        expect(print.mock.calls).toEqual([["remove never runs in production"]])
    })

    it.each(["local", "both"] as const)("refuses on dev while the target %s still seeds dev", async (target) => {
        const { service, workspaces, lobby, print } = await build([NIVO, WEB])

        await expect(service.remove(envelope(target), "dev", true)).rejects.toMatchObject({
            params: { field: "target" },
        })

        expect(workspaces.list).not.toHaveBeenCalled()
        expect(lobby.remove).not.toHaveBeenCalled()
        expect(print.mock.calls).toEqual([
            [`nivo-web: target is ${target}: it still seeds dev; move it to prod or off first`],
        ])
    })

    it.each(["prod", "off"] as const)(
        "prints the plan and changes nothing on a dry run (target %s)",
        async (target) => {
            const { service, lobby, print } = await build([NIVO, WEB])

            await service.remove(envelope(target), "dev", false)

            expect(lobby.remove).not.toHaveBeenCalled()
            expect(print.mock.calls).toEqual([[PLAN], ["dry run: nothing removed; run again with --execute to remove"]])
        },
    )

    it("removes the workspace through the owner's delete door with execute", async () => {
        const { service, lobby, print } = await build([NIVO, WEB])

        await service.remove(envelope("prod"), "dev", true)

        expect(lobby.remove).toHaveBeenCalledWith("owner-1", "ws-web", "NIVO Web")
        expect(print.mock.calls).toEqual([[PLAN], ["nivo-web: removed workspace ws-web"]])
    })

    it("says there is nothing to remove when the workspace is gone, from a bare document piped in by hand", async () => {
        const { service, lobby, print } = await build([NIVO, WEB], ["ws-web"])

        await service.remove(JSON.stringify(documentOf("prod")), "dev", true)

        expect(lobby.remove).not.toHaveBeenCalled()
        expect(print.mock.calls).toEqual([['nivo-web: nothing to remove on dev: no live workspace "NIVO Web"']])
    })
})

describe("EnterpriseSeedService > the roster step (ruling R17)", () => {
    it("installs the roster into the enterprise workspace after its identifier is set, with the place of the environment", async () => {
        const install = jest.fn<Promise<boolean>, Parameters<EnterpriseRoster["install"]>>().mockResolvedValue(true)
        const { service, print } = await build([NIVO, WEB], [], { install })

        await service.run(envelope("both"), "dev")

        expect(install.mock.calls).toEqual([[{ workspaceId: "ws-web", ownerId: "owner-1", identifier: "nivo-web", place: "local" }]])
        expect(print.mock.calls.at(-1)).toEqual(["applied"])
    })

    it("a roster that changed nothing on a held workspace and a kept identifier leaves the run unchanged; one that changed makes it applied", async () => {
        const unchanged = await build([NIVO, WEB], [], { install: jest.fn().mockResolvedValue(false) })
        unchanged.enterprise.set.mockResolvedValue({ from: "nivo-web", to: "nivo-web" })
        await unchanged.service.run(envelope("prod"), "production")
        expect(unchanged.print.mock.calls.at(-1)).toEqual(["unchanged"])

        const install = jest.fn().mockResolvedValue(true)
        const changed = await build([NIVO, WEB], [], { install })
        changed.enterprise.set.mockResolvedValue({ from: "nivo-web", to: "nivo-web" })
        await changed.service.run(envelope("prod"), "production")
        expect(install.mock.calls[0]?.[0]).toMatchObject({ place: "prod" })
        expect(changed.print.mock.calls.at(-1)).toEqual(["applied"])
    })
})
