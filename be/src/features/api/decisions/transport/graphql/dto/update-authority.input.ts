import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ValidateNested } from "class-validator"
import { AuthorityPatchInput } from "./authority-patch.input"

@InputType()
/** Saves the changed fields of the authority sheet. */
export class UpdateAuthorityInput {
    /** The fields to change; omitted fields stay as they are. */
    @Field(() => AuthorityPatchInput)
    @ValidateNested()
    @Type(() => AuthorityPatchInput)
    patch!: AuthorityPatchInput
}
