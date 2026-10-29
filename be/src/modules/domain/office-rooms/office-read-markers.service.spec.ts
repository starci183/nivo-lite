import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { OfficeReadMarkersService } from "./office-read-markers.service"
import { OfficeRoomReadEntity } from "./persistence/entities"

describe("OfficeReadMarkersService", () => {
    it("writes the persisted cursor through the caller's transaction instead of a separate connection", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [OfficeReadMarkersService] }).compile()
        const manager = mockEntityManager()
        const write = fakeQueryBuilder({ execute: { raw: [] } })
        answerQueryBuilders(manager, write)

        await moduleRef
            .get(OfficeReadMarkersService)
            .advance("workspace", "account", "sales", "2026-10-25T01:00:00Z", manager)

        expect(manager.createQueryBuilder).toHaveBeenCalledWith(OfficeRoomReadEntity, "office_rooms_reads")

        expect(write.callsOf("insert")).toEqual([[]])
        expect(write.callsOf("values").map((args) => args.map((values) => evaluatedValues(values)))).toEqual([
            [{ workspaceId: "workspace", userId: "account", room: "sales", lastReadAt: ":createdAt::timestamptz" }],
        ])
        expect(write.callsOf("setParameter")).toEqual([["createdAt", "2026-10-25T01:00:00Z"]])
        expect(write.callsOf("execute")).toHaveLength(1)
    })

    it("never moves an existing read marker backwards", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [OfficeReadMarkersService] }).compile()
        const manager = mockEntityManager()
        const write = fakeQueryBuilder({ execute: { raw: [] } })
        answerQueryBuilders(manager, write)

        await moduleRef
            .get(OfficeReadMarkersService)
            .advance("workspace", "account", "sales", "2026-10-25T01:00:00Z", manager)

        expect(write.callsOf("orUpdate")).toEqual([
            [
                ["last_read_at"],
                ["workspace_id", "user_id", "room"],
                { overwriteCondition: { where: "office_rooms_reads.last_read_at < EXCLUDED.last_read_at" } },
            ],
        ])
    })

    it("lets the caller's transaction roll back by surfacing a failed cursor write", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [OfficeReadMarkersService] }).compile()
        const failure = new Error("cursor write failed")
        const manager = mockEntityManager()
        answerQueryBuilders(manager, fakeQueryBuilder({ execute: failure }))

        await expect(
            moduleRef
                .get(OfficeReadMarkersService)
                .advance("workspace", "account", "sales", "2026-10-25T01:00:00Z", manager),
        ).rejects.toBe(failure)
    })
})
