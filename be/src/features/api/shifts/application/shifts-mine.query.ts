import { Query } from "@nestjs/cqrs"
import type { ShiftsMineView } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ShiftsMineRequest } from "./shifts-mine.contracts"

/** Asks for the signed-in person's own shifts view. */
export class ShiftsMineQuery extends Query<ShiftsMineView> {
    constructor(readonly params: ExecuteParams<ShiftsMineRequest>) {
        super()
    }
}
