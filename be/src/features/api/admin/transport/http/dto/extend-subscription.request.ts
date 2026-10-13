import { IsInt, Max, Min } from "class-validator"

/** The bounded HTTP request of extendSubscription. */
export class ExtendSubscriptionRequest {
    /** Whole days to add, 1 to 366. */
    @IsInt()
    @Min(1)
    @Max(366)
    days!: number
}
