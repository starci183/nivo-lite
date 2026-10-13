import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleGateWriteType } from "./module-gate-write.type"

@ObjectType()
/** One thing a module must know before it may act. */
export class ModuleGateType {
    /** The stable gate key. */
    @Field()
    key!: string

    /** The Vietnamese gate title. */
    @Field()
    label_vi!: string

    /** The English gate title. */
    @Field()
    label_en!: string

    /** The Vietnamese hint under the gate. */
    @Field()
    hint_vi!: string

    /** The English hint under the gate. */
    @Field()
    hint_en!: string

    /** What the setup chat writes from the answer. */
    @Field(() => [ModuleGateWriteType], { nullable: true })
    writes?: ReadonlyArray<ModuleGateWriteType> | null
}
