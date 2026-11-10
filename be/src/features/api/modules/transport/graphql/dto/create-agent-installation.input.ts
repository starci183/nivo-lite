import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** Creates one more agent of a role: the name its customers see, its handle, picture and channels, and where its setup starts. */
export class CreateAgentInstallationInput {
    /** The role (module key). */
    @Field()
    @IsString()
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    @MaxLength(24)
    moduleKey!: string

    /** The name the customers see. */
    @Field()
    @IsString()
    @MaxLength(80)
    name!: string

    /** The @handle; null or absent to make one from the name. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    handle: string | null = null

    /** A preset picture (nivo-ai, role, initials, a shop mark); null or absent for none. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    avatarPreset: string | null = null

    /** The object path of an uploaded picture (from requestAgentAvatarUpload); it wins over a preset. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    avatarPath: string | null = null

    /** The channel connections the agent answers; each must be free for the role. */
    @Field(() => [ID], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsUUID("4", { each: true })
    @MaxLength(36, { each: true })
    connectionIds: Array<string> = []

    /** Where the setup starts: copy (from the installation copyFrom) or default. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["copy", "default"])
    startFrom: "copy" | "default" = "default"

    /** The installation of the same role to copy the setup of, when startFrom is copy. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    copyFrom: string | null = null
}
