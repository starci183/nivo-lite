import { readFileSync } from "node:fs"
import path from "node:path"
import { BrainSeedService, RecordsSeedService } from "@modules/domain/channel-provisioning"
import { EntityEngineService, EntityMutationService, ModuleAgentService, entityEngineEntities } from "@modules/domain/entity-engine"
import { KnowledgeSourcesReadService, ProfileSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { persistSeedShop } from "../../fixtures/builders/seed-shop.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const [RecordEntity] = entityEngineEntities

/** The stack seed data of the demo flower shop, read from disk as the seed steps of the dev stack read them. */
const DATA = path.resolve(__dirname, "../../../../../.starcistacks/dev/seeds/data")
/** The most rows one read takes: the seed holds seven documents and one settings record. */
const ROWS = 50

/** The envelope the stack seed step writes to the command's stdin: the file's own text is the document, never parsed here. */
const envelopeOf = (file: string): string =>
    `{"documents":[{"path":"data/${file}","document":${readFileSync(path.join(DATA, file), "utf8")}}]}\n`

const world = useTestWorld({ modules: API_APP_MODULES })

/** A workspace with an owner, named for its own scenario; the seed steps find it by name as they find NIVO. */
const shop = async () => {
    const ids = { workspaceId: world.id(), ownerId: world.id(), name: `NIVO-${world.id()}` }
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, ids.workspaceId)
        await removeAuthUsers(world.db.primary, [ids.ownerId])
    })
    await persistSeedShop(world.db.primary, ids)
    return ids
}

/** The two seed steps, built over the real services of the world (the cli app composes the same ones). */
const steps = () => {
    const printed: Array<string> = []
    const options: ConstructorParameters<typeof BrainSeedService>[0] = {
        telegramToken: undefined,
        zaloAppId: undefined,
        zaloAppSecret: undefined,
        zaloOaSecret: undefined,
        print: (line) => printed.push(line),
    }
    const workspaces = world.resolve(WorkspacesService)
    const sources = new ProfileSourcesService(world.db.primary, world.resolve(CLOCK), world.resolve(KnowledgeQueue))
    return {
        printed,
        brain: new BrainSeedService(options, sources, workspaces),
        records: new RecordsSeedService(
            options,
            world.resolve(EntityEngineService),
            world.resolve(EntityMutationService),
            world.resolve(ModuleAgentService),
            workspaces,
        ),
    }
}

describe("the seed of the demo flower shop", () => {
    it("keeps the Brain documents as queued knowledge sources, listed by origin, and a rerun changes nothing", async () => {
        const { workspaceId, name } = await shop()
        const run = steps()

        await run.brain.run(envelopeOf("brain-tiem-hoa.json"), name)
        const shown = await world.resolve(KnowledgeSourcesReadService).ofOrigin(workspaceId, "seed:tiem-hoa", ROWS)

        expect(shown.filter((source) => source.visibility === "public")).toHaveLength(5)
        expect(shown.filter((source) => source.visibility === "internal")).toHaveLength(2)
        expect(shown.every((source) => source.status === "queued")).toBe(true)
        expect(run.printed).toHaveLength(7)
        expect(run.printed.every((line) => line.endsWith(" inserted"))).toBe(true)

        const again = steps()
        await again.brain.run(envelopeOf("brain-tiem-hoa.json"), name)

        expect(again.printed.every((line) => line.endsWith(" unchanged"))).toBe(true)
        expect(
            await world.resolve(KnowledgeSourcesReadService).ofOrigin(workspaceId, "seed:tiem-hoa", ROWS),
        ).toHaveLength(7)
    })

    it("writes the Sales rules through the entity engine: maxDiscountPct 10 and the 5.000.000 threshold, once", async () => {
        const { workspaceId, name } = await shop()
        const run = steps()

        await run.records.run(envelopeOf("records-tiem-hoa.json"), name)
        await run.records.run(envelopeOf("records-tiem-hoa.json"), name)
        const rules = await world.db.primary.find(RecordEntity, {
            where: { entity: "blocks-core.sales.settings", workspaceId },
            take: ROWS,
        })

        expect(rules.map((record) => record.data)).toEqual([
            expect.objectContaining({ key: "sales", maxDiscountPct: 10, approvalThresholdVnd: 5_000_000 }),
        ])
    })
})
