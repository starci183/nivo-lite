import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { EngineFailureService } from "./engine-failure.service"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import { RECORD_CONTACTS } from "./record-contacts.port"
import type { RecordContactsPort } from "./record-contacts.port"

const WS = "11111111-1111-4111-8111-111111111111"
const SURVIVOR = "55555555-5555-4555-8555-555555555555"
const MERGED = "33333333-3333-4333-8333-333333333333"
const KEY_B64 = Buffer.alloc(32, 7).toString("base64")

const CANDIDATE: EntityDefinition = {
    entry: "entity",
    name: "blocks-core.hiring.candidate",
    dataKind: "hiring-candidate",
    fields: { person: { kind: "contact", nullable: false }, name: { kind: "text", nullable: false, maxLength: 40 } },
    indexes: [{ name: "person_recent", on: ["person", { desc: "createdAt" }, { desc: "id" }] }],
}

const LIST: Query = {
    from: CANDIDATE.name,
    select: ["name"],
    where: { op: "eq", field: "person", value: SURVIVOR },
    order: [
        ["person", "asc"],
        ["createdAt", "desc"],
        ["id", "desc"],
    ],
    page: { size: 10 },
}

const build = async (contacts?: RecordContactsPort) => {
    const em = mockEntityManager()
    fakeTransaction(em)
    const failures = mock<EngineFailureService>()
    failures.reading.mockImplementation((_entity, work) => work())
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityEngineService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            {
                provide: ENTITY_ENGINE_OPTIONS,
                useValue: builder<EntityEngineOptions>({
                    entities: [CANDIDATE],
                    jobs: [],
                    cursorKey: new Secret(KEY_B64),
                })(),
            },
            { provide: EngineFailureService, useValue: failures },
            ...(contacts === undefined
                ? []
                : [{ provide: RECORD_CONTACTS, useValue: mock<RecordContactsPort>(contacts) }]),
        ],
    }).compile()
    return { engine: moduleRef.get(EntityEngineService), em }
}

describe("a filter on a contact field follows merges at read time", () => {
    it("matches the records written under every id merged into the contact (the contacts' one redirect)", async () => {
        const contacts: RecordContactsPort = {
            currentOf: jest.fn(),
            aliasesOf: jest.fn(() => Promise.resolve(new Map([[SURVIVOR, [SURVIVOR, MERGED]]]))),
        }
        const { engine, em } = await build(contacts)
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])

        await engine.list(mintScopedTx({ manager: em, workspaceId: WS }), LIST, "scope-1")

        expect(contacts.aliasesOf).toHaveBeenCalledWith(WS, [SURVIVOR])
        expect(JSON.stringify(fake?.callsOf("setParameters"))).toContain(MERGED)
    })

    it("reads the filter as written when no contacts port is bound", async () => {
        const { engine, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])

        await engine.list(mintScopedTx({ manager: em, workspaceId: WS }), LIST, "scope-1")

        expect(JSON.stringify(fake?.callsOf("setParameters"))).not.toContain(MERGED)
    })
})
