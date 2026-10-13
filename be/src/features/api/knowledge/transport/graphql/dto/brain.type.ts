import { Field, Int, ObjectType } from "@nestjs/graphql"
import { BrainFactType } from "./brain-fact.type"
import { BrainLessonType } from "./brain-lesson.type"
import { BrainGapType } from "./brain-gap.type"
import { BrainExtractionType } from "./brain-extraction.type"
import { BrainLensType } from "./brain-lens.type"

@ObjectType()
/** Everything the Second Brain page shows. */
export class BrainType {
    /** The facts in force, waiting or scheduled (owners and managers only). */
    @Field(() => [BrainFactType])
    facts!: Array<BrainFactType>

    /** The lessons in force, waiting or retired. */
    @Field(() => [BrainLessonType])
    lessons!: Array<BrainLessonType>

    /** The customer questions nobody answered, the most asked first (owners and managers only). */
    @Field(() => [BrainGapType])
    gaps!: Array<BrainGapType>

    /** How many questions are open in all. */
    @Field(() => Int)
    gapsOpen!: number

    /** Where the reading of each document stands (owners and managers only). */
    @Field(() => [BrainExtractionType])
    extractions!: Array<BrainExtractionType>

    /** The agents the owner can look through. */
    @Field(() => [BrainLensType])
    lenses!: Array<BrainLensType>
}
