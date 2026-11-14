import { Test } from "@nestjs/testing"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { accountDataPlanOf } from "./account-data-plan.policy"

const SUBJECT = Symbol("account-data-plan.policy")

const build = async (): Promise<typeof import("./account-data-plan.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { accountDataPlanOf } }],
    }).compile()
    return moduleRef.get<typeof import("./account-data-plan.policy")>(SUBJECT)
}

const user: AccountDataTypeDef = {
    name: "telegram.user",
    provider: "telegram",
    version: 1,
    write: "overwrite",
    fields: {
        userId: { type: "integer", required: true },
        username: { type: "text", required: false, maxLength: 64 },
    },
    key: ["userId"],
    retention: "keep",
    indexes: [{ name: "username", on: ["username", "userId"] }],
}
const cursor: AccountDataTypeDef = {
    name: "imap.read-cursor",
    provider: "imap",
    version: 1,
    write: "advance",
    fields: { agentId: { type: "text", required: true } },
    key: ["agentId"],
    position: "agentId",
    retention: "keep",
}

describe("accountDataPlanOf", () => {
    let policy: typeof import("./account-data-plan.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("plans each type's partition, a CHECK per member and its indexes, sorted by type, as data only", () => {
        expect(policy.accountDataPlanOf([user, cursor])).toEqual({
            partitions: [
                {
                    type: "imap.read-cursor",
                    partition: "account_data_imap_read_cursor",
                    checks: [
                        {
                            name: "account_data_imap_read_cursor_agent_id_chk",
                            field: "agentId",
                            fieldType: "text",
                            required: true,
                        },
                    ],
                    indexes: [],
                },
                {
                    type: "telegram.user",
                    partition: "account_data_telegram_user",
                    checks: [
                        {
                            name: "account_data_telegram_user_user_id_chk",
                            field: "userId",
                            fieldType: "integer",
                            required: true,
                        },
                        {
                            name: "account_data_telegram_user_username_chk",
                            field: "username",
                            fieldType: "text",
                            required: false,
                            maxLength: 64,
                        },
                    ],
                    indexes: [
                        {
                            name: "account_data_telegram_user_username",
                            fields: [
                                { name: "username", fieldType: "text" },
                                { name: "userId", fieldType: "integer" },
                            ],
                        },
                    ],
                },
            ],
        })
    })

    it("plans nothing for no declaration", () => {
        expect(policy.accountDataPlanOf([])).toEqual({ partitions: [] })
    })
})
