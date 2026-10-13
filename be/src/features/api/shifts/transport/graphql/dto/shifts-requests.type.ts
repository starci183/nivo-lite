import { Field, ObjectType } from "@nestjs/graphql"
import { ShiftsLeaveType } from "./shifts-leave.type"
import { ShiftsSwapType } from "./shifts-swap.type"
import { ShiftsAvailabilityType } from "./shifts-availability.type"

@ObjectType()
/** The requests of the workbench. */
export class ShiftsRequestsType {
    /** The leave requests. */
    @Field(() => [[ShiftsLeaveType]])
    leaves!: ReadonlyArray<ShiftsLeaveType>

    /** The swap and claim requests. */
    @Field(() => [[ShiftsSwapType]])
    swaps!: ReadonlyArray<ShiftsSwapType>

    /** The availability statements. */
    @Field(() => [[ShiftsAvailabilityType]])
    availability!: ReadonlyArray<ShiftsAvailabilityType>
}
