import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** What the contacts list asks: a search (an exact phone or mail, or a name prefix), else a page after a cursor. */
export class ContactsInput {
    /** A phone or a mail address in any written form, or the start of a name. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(320)
    search?: string

    /** The cursor the previous page answered. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    cursor?: string

    /** The most contacts of the page. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    size?: number
}

@InputType()
/** One contact by its id. */
export class ContactInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}

@InputType()
/** The contact whose module blocks the detail asks for. */
export class ContactModuleBlocksInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    contactId!: string
}

@InputType()
/** A change of a contact's display name and / or tags. */
export class UpdateContactInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** The display name; empty clears it. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    displayName?: string

    /** The whole set of tags. */
    @Field(() => [String], { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(40, { each: true })
    tags?: Array<string>
}

@InputType()
/** An identity a person links to a contact: a phone, a mail address, or an outside system's customer id on an account. */
export class LinkContactIdentityInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    contactId!: string

    /** `phone`, `email` or `external`. */
    @Field(() => String)
    @IsIn(["phone", "email", "external"])
    @MaxLength(10)
    kind!: string

    /** The value as the person typed it. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(320)
    value!: string

    /** For an outside id: the account it belongs to. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    account?: string
}

@InputType()
/** An identity a person takes away from a contact. */
export class UnlinkContactIdentityInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    contactId!: string

    /** The identity. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    identityId!: string
}

@InputType()
/** Two contacts a person decides are one: `from` goes into `into`. */
export class MergeContactsInput {
    /** The contact that takes the other over. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    intoContactId!: string

    /** The contact that goes. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    fromContactId!: string
}

@InputType()
/** Facts of a contact the agents forget. */
export class ForgetContactMemoryInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    contactId!: string

    /** The fact names. */
    @Field(() => [String])
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    facts!: Array<string>
}

@InputType()
/** A contact the owner erases. */
export class DeleteContactInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}

@InputType()
/** What a person asks of the conversation on one route (owner ruling R26): the route, a page after a cursor, a lower limit in time. */
export class CustomerMessagesInput {
    /** The route: this person on this account. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    routeId!: string

    /** The cursor the previous (newer) page answered. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(40)
    after?: string

    /** Only the lines said from this instant on (ISO 8601), e.g. a visit's start. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsISO8601()
    @MaxLength(40)
    since?: string

    /** The most lines of the page. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number
}

@InputType()
/** What a person asks of the whole conversation with a contact: one route or all, a page before a cursor. */
export class ContactMessagesInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    contactId!: string

    /** One route of the contact; absent reads every route, merged by time. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    routeId?: string

    /** The cursor the previous (newer) page answered: only older lines come back. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(40)
    before?: string

    /** The most lines of the page, 1 to 50. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number
}

@InputType()
/** What a person asks of the work the agents did for a contact. */
export class ContactWorkInput {
    /** The contact. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    contactId!: string

    /** The most rows, 1 to 50. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number
}
