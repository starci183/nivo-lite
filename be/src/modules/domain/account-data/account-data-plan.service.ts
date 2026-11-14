import { Injectable } from "@nestjs/common"
import type { AccountDataPlan, AccountDataPlanOutput } from "./account-data.contracts"
import { accountDataPlanOf } from "./account-data-plan.policy"
import { AccountDataTypesService } from "./account-data-types.service"

@Injectable()
/** `cli account-data plan --json`: the DDL-free plan of the app's declared types, printed as JSON. Reads no database and writes no file. */
export class AccountDataPlanService {
    constructor(private readonly types: AccountDataTypesService) {}

    /** The plan of every declared type. */
    plan(): AccountDataPlan {
        return accountDataPlanOf(this.types.all())
    }

    /** Prints the plan as JSON with a closing newline. */
    async print(out: AccountDataPlanOutput): Promise<void> {
        await Promise.resolve(out.write(`${JSON.stringify(this.plan(), null, 2)}\n`))
    }
}
