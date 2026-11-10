import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MyWorkInHandRequest } from "./my-work-in-hand.contracts"

/** Asks how many open work items are assigned to the caller in a workspace. */
export class MyWorkInHandQuery extends Query<number> {
    constructor(readonly params: ExecuteParams<MyWorkInHandRequest>) {
        super()
    }
}
