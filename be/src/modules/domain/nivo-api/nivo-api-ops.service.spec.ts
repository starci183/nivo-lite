import { Test } from "@nestjs/testing"
import { Query } from "@nestjs/cqrs"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { ExecuteParams } from "@modules/platform/cqrs"
import { NIVO_API_OP_GROUPS } from "./nivo-api.decorators"
import type { NivoApiOpGroup } from "./nivo-api-ops.contracts"
import { NivoApiOpsService } from "./nivo-api-ops.service"

/** A query of a feature. */
class FakeQuery extends Query<unknown> {
    constructor(readonly params: ExecuteParams<unknown>) {
        super()
    }
}

const GROUP: NivoApiOpGroup = { handlers: [], queries: { [NIVO_API.contact.list]: FakeQuery }, commands: {} }

describe("NivoApiOpsService", () => {
    it("finds the op a feature declared, and nothing for a name no feature declared", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [NivoApiOpsService, { provide: NIVO_API_OP_GROUPS, useValue: [GROUP] }],
        }).compile()
        const ops = moduleRef.get(NivoApiOpsService)

        expect(ops.opOf(NIVO_API.contact.list)).toMatchObject({ readOnly: true, dispatch: { message: FakeQuery } })
        expect(ops.opOf(NIVO_API.contact.get)).toBeNull()
        expect(ops.opOf(NIVO_API.workspace.delete)).toBeNull()
    })
})
