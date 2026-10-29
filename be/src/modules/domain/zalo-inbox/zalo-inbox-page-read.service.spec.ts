import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import { ZaloInboxPageReadService } from "./zalo-inbox-page-read.service"

const TABLE = "public.zalo_inbox"

const build = async (rows: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const seen = answerByTable(em, { [TABLE]: rows })
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloInboxPageReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ZaloInboxPageReadService), seen }
}

describe("ZaloInboxPageReadService", () => {
    it("reads the newest twenty follow events of a connection", async () => {
        const follow = { id: "f-1", received_at: "2026-10-28T08:00:00.000Z" }
        const { service, seen } = await build([follow])

        await expect(service.followEvents("c-1")).resolves.toEqual([follow])
        expect(seen.queriesOf(TABLE)[0]?.callsOf("limit")).toEqual([[20]])
        expect(seen.queriesOf(TABLE)[0]?.callsOf("where")).toEqual([
            ["i.payload->>'connection' = :connectionId", { connectionId: "c-1" }],
        ])
    })

    it("reads the facts of a connection", async () => {
        const facts = { last_at: "2026-10-28T09:30:00.000Z", has_text: true, has_follow: false }
        const { service } = await build([facts])

        await expect(service.factsOf("c-1")).resolves.toEqual(facts)
    })

    it("answers null when the inbox has no row of the connection", async () => {
        const { service } = await build([])

        await expect(service.factsOf("c-1")).resolves.toBeNull()
    })
})
