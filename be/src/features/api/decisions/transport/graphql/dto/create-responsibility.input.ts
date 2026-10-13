import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { NewResponsibilityInput } from "./new-responsibility.input"

@InputType()
/** Adds a responsibility for a customer. */
export class CreateResponsibilityInput {
    /** The responsibility to add. */
    @Field(() => NewResponsibilityInput)
    @ValidateNested()
    @Type(() => NewResponsibilityInput)
    input!: NewResponsibilityInput
}
