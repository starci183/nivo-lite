import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded proof of manually publishing an approved post on one channel. */
export class MarkContentPublishedInput {
    /** The approved post within the selected workspace. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** One selected channel. */
    @Field()
    @IsIn(["facebook", "zalo", "tiktok", "instagram"])
    @MaxLength(20)
    channel!: string

    /** The external post URL; empty when the proof is a note. */
    @Field({ defaultValue: "" })
    @IsString()
    @MaxLength(2000)
    url!: string

    /** How it was posted, with a server default when empty. */
    @Field({ defaultValue: "" })
    @IsString()
    @MaxLength(1000)
    how!: string
}
