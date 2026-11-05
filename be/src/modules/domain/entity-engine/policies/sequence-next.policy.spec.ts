import { Test } from "@nestjs/testing"
import { isRecord } from "@modules/platform/primitives"
import { mockEntityManager } from "@starci/jest-preset"
import { WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { EntitySequenceEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { mintScopedTx } from "./scoped-tx.policy"
import { nextSequenceValue } from "./sequence-next.policy"

const SEQUENCE_NEXT: unique symbol = Symbol("entity-engine.sequence-next")

interface SequenceNextPolicy {
    readonly nextSequenceValue: typeof nextSequenceValue
}

const build = async (): Promise<SequenceNextPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SEQUENCE_NEXT, useFactory: (): SequenceNextPolicy => ({ nextSequenceValue }) }],
    }).compile()
    return moduleRef.get<SequenceNextPolicy>(SEQUENCE_NEXT)
}

const KEY = { workspaceId: WORKSPACE_ID, entity: "sales.lead", field: "code", period: "2026" }

describe("nextSequenceValue", () => {
    it("creates the counter row when missing, then increments it in one UPDATE ... RETURNING", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [insert, update] = queueQueryBuilders(em, [{ execute: {} }, { execute: { raw: [{ value: "7" }] } }])

        const next = await policy.nextSequenceValue(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            "sales.lead",
            "code",
            "2026",
        )

        expect(next).toBe(7)
        expect(insert?.callsOf("into")).toEqual([[EntitySequenceEntity]])
        expect(insert?.callsOf("values")).toEqual([[KEY]])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(update?.callsOf("update")).toEqual([[EntitySequenceEntity]])
        expect(update?.callsOf("where")).toEqual([[KEY]])
        expect(update?.callsOf("returning")).toEqual([["value"]])
    })

    it("increments with the database's own expression, never a value computed here", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [, update] = queueQueryBuilders(em, [{ execute: {} }, { execute: { raw: [{ value: "1" }] } }])

        await policy.nextSequenceValue(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            "sales.lead",
            "code",
            "",
        )

        const assignments = update?.callsOf("set")[0]?.[0]
        const increment = isRecord(assignments) ? assignments.value : undefined
        expect(typeof increment).toBe("function")
        expect(typeof increment === "function" ? Reflect.apply(increment, undefined, []) : undefined).toBe("value + 1")
    })

    it("refuses an update that returned no counter", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ execute: {} }, { execute: { raw: [] } }])

        await expect(
            policy.nextSequenceValue(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                "sales.lead",
                "code",
                "",
            ),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.ResultMissing })
    })
})
