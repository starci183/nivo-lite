import { Test } from "@nestjs/testing"
import { createHash } from "node:crypto"
import {
    accountCheckNameOf,
    accountExternalIdOf,
    accountIndexNameOf,
    accountPartitionOf,
    expiriesOf,
    insertedIdOf,
    isConnectionId,
    readLimitOf,
    scopedDeliveryIdOf,
    snakeOf,
    sweepBatchOf,
    valueOf,
} from "./account-data.policy"
import { defineAccountDataType } from "./define-account-data-type.policy"

const SUBJECT = Symbol("account-data.policy")

const build = async (): Promise<typeof import("./account-data.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    accountCheckNameOf,
                    accountExternalIdOf,
                    accountIndexNameOf,
                    accountPartitionOf,
                    expiriesOf,
                    insertedIdOf,
                    isConnectionId,
                    readLimitOf,
                    scopedDeliveryIdOf,
                    snakeOf,
                    sweepBatchOf,
                    valueOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./account-data.policy")>(SUBJECT)
}

const CONNECTION = "0b8e6f4a-6c1e-4d47-9a51-1f3c2b7d9e10"

describe("account-data names", () => {
    let policy: typeof import("./account-data.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("names the partition, the CHECK of a member and a declared index as the entity engine names records'", () => {
        expect(policy.accountPartitionOf("telegram.update")).toBe("account_data_telegram_update")
        expect(policy.accountPartitionOf("imap.read-cursor")).toBe("account_data_imap_read_cursor")
        expect(policy.accountCheckNameOf("telegram.message", "chatId")).toBe(
            "account_data_telegram_message_chat_id_chk",
        )
        expect(policy.accountIndexNameOf("telegram.message", "username")).toBe("account_data_telegram_message_username")
        expect(policy.snakeOf("updateId")).toBe("update_id")
    })

    it("cuts a generated name at the 63 bytes postgres keeps", () => {
        expect(policy.accountCheckNameOf("telegram.message", "aVeryLongMemberNameThatGoesOnAndOn")).toHaveLength(63)
    })
})

describe("scopedDeliveryIdOf", () => {
    let policy: typeof import("./account-data.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("splits a connection-scoped delivery id into the connection and the stored key", () => {
        expect(policy.scopedDeliveryIdOf(`${CONNECTION}:42`)).toEqual({ connectionId: CONNECTION, externalId: "42" })
        expect(policy.scopedDeliveryIdOf(`${CONNECTION}:-100:7`)).toEqual({
            connectionId: CONNECTION,
            externalId: "-100:7",
        })
    })

    it("hashes a key longer than a row allows, as the intake stored it", () => {
        const key = "k".repeat(401)

        expect(policy.scopedDeliveryIdOf(`${CONNECTION}:${key}`)?.externalId).toBe(
            `sha256:${createHash("sha256").update(key).digest("hex")}`,
        )
        expect(policy.accountExternalIdOf("short")).toBe("short")
    })

    it("answers null without a connection, a colon or a key", () => {
        expect(policy.scopedDeliveryIdOf("not-a-connection:42")).toBeNull()
        expect(policy.scopedDeliveryIdOf(`${CONNECTION}42`)).toBeNull()
        expect(policy.scopedDeliveryIdOf(`${CONNECTION}:`)).toBeNull()
        expect(policy.isConnectionId(CONNECTION)).toBe(true)
    })
})

describe("expiriesOf", () => {
    let policy: typeof import("./account-data.policy")

    beforeAll(async () => {
        policy = await build()
    })

    const base = {
        provider: "telegram",
        version: 1,
        fields: { id: { type: "text", required: true } },
        key: ["id"],
    } as const

    it("expires a wakes type's completed rows after its days, and every row of a ttl type after its ttl", () => {
        expect(
            policy.expiriesOf(
                defineAccountDataType({
                    ...base,
                    name: "telegram.update",
                    write: "append",
                    wakes: true,
                    retention: { days: 30 },
                }),
            ),
        ).toEqual([{ type: "telegram.update", seconds: 30 * 86_400, processedOnly: true }])
        expect(
            policy.expiriesOf(
                defineAccountDataType({
                    ...base,
                    name: "telegram.snap",
                    write: "overwrite",
                    ttlMs: 60_000,
                    retention: "keep",
                }),
            ),
        ).toEqual([{ type: "telegram.snap", seconds: 60, processedOnly: false }])
    })

    it("expires nothing of a type kept for good", () => {
        expect(
            policy.expiriesOf(
                defineAccountDataType({ ...base, name: "telegram.message", write: "append", retention: "keep" }),
            ),
        ).toEqual([])
    })
})

describe("bounds and raw answers", () => {
    let policy: typeof import("./account-data.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("reads the sweep batch from the payload within 1 to 5000, else 1000", () => {
        expect(policy.sweepBatchOf({ batch: 50 })).toBe(50)
        expect(policy.sweepBatchOf({ batch: 0 })).toBe(1000)
        expect(policy.sweepBatchOf({ batch: "50" })).toBe(1000)
        expect(policy.sweepBatchOf(null)).toBe(1000)
    })

    it("bounds a read limit within 1 and 200", () => {
        expect(policy.readLimitOf(0)).toBe(1)
        expect(policy.readLimitOf(500)).toBe(200)
        expect(policy.readLimitOf(7.9)).toBe(7)
    })

    it("reads the id an insert returned", () => {
        expect(policy.insertedIdOf([{ id: "r1" }])).toBe("r1")
        expect(policy.insertedIdOf([])).toBeNull()
        expect(policy.insertedIdOf(undefined)).toBeNull()
        expect(policy.valueOf({ a: 1 })).toEqual({ a: 1 })
    })
})
