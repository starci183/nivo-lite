import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Selects a single sales order. */
export class SalesOrderInput {
    /** The order id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
