import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What "run now" on a scheduled item did. */
export class RunScheduledItemNowType {
    /**
     * ran (the item's own job moved to now; the workflow goes on as if its time had come), already_ran (it fired already, someone pressed
     * first, or it moved on since the list was read), not_scheduled (nothing of that key is scheduled any more), refused (the run no
     * longer waits for that deadline) or invalid (not an item key).
     */
    @Field(() => String)
    outcome!: string

    /** The item key as asked. */
    @Field(() => String)
    id!: string
}
