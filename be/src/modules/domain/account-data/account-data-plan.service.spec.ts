import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import { AccountDataPlanService } from "./account-data-plan.service"
import { AccountDataTypesService } from "./account-data-types.service"

const update: AccountDataTypeDef = {
    name: "telegram.update",
    provider: "telegram",
    version: 1,
    write: "append",
    fields: { updateId: { type: "text", required: true, maxLength: 40 } },
    key: ["updateId"],
    wakes: true,
    retention: { days: 30 },
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataPlanService,
            AccountDataTypesService,
            { provide: ACCOUNT_DATA_OPTIONS, useValue: { types: [update] } },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return moduleRef.get(AccountDataPlanService)
}

const PLAN = {
    partitions: [
        {
            type: "telegram.update",
            partition: "account_data_telegram_update",
            checks: [
                {
                    name: "account_data_telegram_update_update_id_chk",
                    field: "updateId",
                    fieldType: "text",
                    required: true,
                    maxLength: 40,
                },
            ],
            indexes: [],
        },
    ],
}

describe("AccountDataPlanService", () => {
    it("plans the declared types of the app", async () => {
        const planner = await build()

        expect(planner.plan()).toEqual(PLAN)
    })

    it("prints the plan as JSON with a closing newline", async () => {
        const planner = await build()
        const chunks: Array<string> = []

        await planner.print({ write: (text: string) => chunks.push(text) })

        expect(chunks).toEqual([`${JSON.stringify(PLAN, null, 2)}\n`])
    })
})
