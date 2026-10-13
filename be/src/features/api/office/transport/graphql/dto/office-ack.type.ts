import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The answer of an Office mutation that returns nothing else. */
export class OfficeAckType {
    /** Always true: a failure is an error answer. */
    @Field()
    ok!: boolean
}
