import { Test } from "@nestjs/testing"
import { Command, Query } from "@nestjs/cqrs"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { ExecuteParams } from "@modules/platform/cqrs"
import { NIVO_API_TABLE } from "./nivo-api.declarations"
import type { NivoApiOpGroup } from "./nivo-api-ops.contracts"
import { nivoApiOpTableOf } from "./nivo-api-ops.policy"

const SUBJECT = Symbol("nivo-api-ops.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nivoApiOpTableOf } }],
    }).compile()
    return moduleRef.get<typeof import("./nivo-api-ops.policy")>(SUBJECT)
}

/** A query of a feature. */
class FakeQuery extends Query<unknown> {
    constructor(readonly params: ExecuteParams<unknown>) {
        super()
    }
}

/** A command of a feature. */
class FakeCommand extends Command<unknown> {
    constructor(readonly params: ExecuteParams<unknown>) {
        super()
    }
}

const EXPOSED = Object.entries(NIVO_API_TABLE)
    .filter(([, declaration]) => declaration.exposed)
    .map(([name]) => name)

describe("nivoApiOpTableOf: the registry of the ops the features declare", () => {
    it("registers a declared exposed op with the message its feature names, and the read-only mark, scope, request and answer of its declaration", async () => {
        const group: NivoApiOpGroup = {
            handlers: [],
            queries: { [NIVO_API.contact.list]: FakeQuery },
            commands: { [NIVO_API.stop.answer]: FakeCommand },
        }

        const table = (await build()).nivoApiOpTableOf([group])

        expect(table.ops.get(NIVO_API.contact.list)).toMatchObject({ readOnly: true, scope: "data", dispatch: { bus: "query", message: FakeQuery } })
        expect(table.ops.get(NIVO_API.stop.answer)).toMatchObject({ readOnly: false, scope: "run", dispatch: { bus: "command", message: FakeCommand } })
        expect(table.ops.get(NIVO_API.contact.list)?.request({}, { workspaceId: "ws-1", opKey: null })).toEqual({ workspaceId: "ws-1" })
        expect(table.ops.get(NIVO_API.contact.get)).toBeUndefined()
        expect(table.duplicated).toEqual([])
    })

    it("reports every exposed op no group declares, and none that one does", async () => {
        const table = (await build()).nivoApiOpTableOf([{ handlers: [], queries: { [NIVO_API.contact.list]: FakeQuery }, commands: {} }])

        expect(table.uncovered).toEqual(EXPOSED.filter((name) => name !== NIVO_API.contact.list))
        expect((await build()).nivoApiOpTableOf([]).uncovered).toEqual(EXPOSED)
    })

    it("keeps the first declaration of an op two groups declare, and reports it", async () => {
        class OtherQuery extends FakeQuery {}
        const first: NivoApiOpGroup = { handlers: [], queries: { [NIVO_API.contact.list]: FakeQuery }, commands: {} }
        const second: NivoApiOpGroup = { handlers: [], queries: { [NIVO_API.contact.list]: OtherQuery }, commands: {} }

        const table = (await build()).nivoApiOpTableOf([first, second])

        expect(table.ops.get(NIVO_API.contact.list)?.dispatch.message).toBe(FakeQuery)
        expect(table.duplicated).toEqual([NIVO_API.contact.list])
    })
})
