import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The identity returned by the simulator mutation. */
export class InboundSimulationStatusInput {
    /** The stored inbound event whose processing the caller follows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
