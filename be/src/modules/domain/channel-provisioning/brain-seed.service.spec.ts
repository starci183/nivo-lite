import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { ProfileSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspacesService } from "@modules/domain/workspaces"
import { BrainSeedService } from "./brain-seed.service"
import { BRAIN_SEED_SCHEMA } from "./brain-seed.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"

const DOCUMENT = { title: "Delivery", topic: "Delivery", visibility: "public", content: "Delivery costs 20.000 VND." }
const INTERNAL = {
    title: "Process",
    topic: "Internal process",
    visibility: "internal",
    content: "From 5.000.000 VND the owner approves.",
}
const TEXT = `${JSON.stringify({ documents: [{ path: "data/brain.json", document: { schema: BRAIN_SEED_SCHEMA, origin: "seed:tiem-hoa", documents: [DOCUMENT, INTERNAL] } }] })}\n`

const build = async (
    workspaces: ReadonlyArray<{ id: string; name: string }> = [{ id: "ws-1", name: "NIVO" }],
    owners: ReadonlyArray<string> = ["owner-1"],
) => {
    const sources = mock<ProfileSourcesService>()
    sources.keep.mockResolvedValue("inserted")
    const list = mock<WorkspacesService>()
    list.list.mockResolvedValue(workspaces)
    list.ownerIdsOf.mockResolvedValue(owners)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: ProfileSourcesService, useValue: sources },
            { provide: WorkspacesService, useValue: list },
        ],
    }).compile()
    return { service: moduleRef.get(BrainSeedService), sources, print }
}

describe("BrainSeedService > run", () => {
    it.each([["inserted"], ["requeued"], ["unchanged"]] as const)(
        "keeps each document in the named workspace under the owner and prints that it was %s",
        async (outcome) => {
            const { service, sources, print } = await build()
            sources.keep.mockResolvedValue(outcome)

            await service.run(TEXT, "NIVO")

            expect(sources.keep.mock.calls).toEqual([
                [{ workspaceId: "ws-1", ownerId: "owner-1", origin: "seed:tiem-hoa", module: null, ...DOCUMENT }],
                [{ workspaceId: "ws-1", ownerId: "owner-1", origin: "seed:tiem-hoa", module: null, ...INTERNAL }],
            ])
            expect(print.mock.calls).toEqual([
                [`brain seed:tiem-hoa public Delivery ${outcome}`],
                [`brain seed:tiem-hoa internal Process ${outcome}`],
            ])
        },
    )
})

describe("BrainSeedService > refusals", () => {
    it.each([
        ["no workspace of that name", [], ["owner-1"], "workspace"],
        [
            "two workspaces of that name",
            [
                { id: "ws-1", name: "NIVO" },
                { id: "ws-2", name: "NIVO" },
            ],
            ["owner-1"],
            "workspace",
        ],
        ["a workspace without an owner", [{ id: "ws-1", name: "NIVO" }], [], "workspace.owner"],
    ])("refuses %s before it writes anything", async (_name, workspaces, owners, field) => {
        const { service, sources } = await build(workspaces, owners)

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } }),
        )

        expect(sources.keep).not.toHaveBeenCalled()
    })
})
