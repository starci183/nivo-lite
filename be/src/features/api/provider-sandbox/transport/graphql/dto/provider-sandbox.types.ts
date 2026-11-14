import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Whether the dev sandbox is on in this environment. */
export class ProviderSandboxStateType {
    /** True when the sandbox is on; the page hides itself when it is not. */
    @Field(() => Boolean)
    enabled!: boolean
}

@ObjectType()
/** One agent a sandbox account is attached to. */
export class SandboxAccountAgentType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** The agent's name. */
    @Field(() => String)
    label!: string
}

@ObjectType()
/** One sandbox account of the workspace. */
export class SandboxAccountType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The provider key. */
    @Field(() => String)
    provider!: string

    /** The name the owner gave it. */
    @Field(() => String)
    name!: string

    /** `pending`, `connected`, `error` or `disconnected`. */
    @Field(() => String)
    status!: string

    /** When it was created, ISO 8601. */
    @Field(() => String, { nullable: true })
    createdAt!: string | null

    /** The agents it is attached to. */
    @Field(() => [SandboxAccountAgentType])
    agents!: Array<SandboxAccountAgentType>
}

@ObjectType()
/** One input field of an inbound case. */
export class SandboxCaseInputFieldType {
    /** The field name, in the provider's own words. */
    @Field(() => String)
    name!: string

    /** What the field is, for the form. */
    @Field(() => String)
    label!: string

    /** `text` or `integer`. */
    @Field(() => String)
    kind!: string

    /** The value shown when nothing prefills it, as text. */
    @Field(() => String)
    example!: string
}

@ObjectType()
/** One hardcoded case of a provider's sandbox. */
export class SandboxCaseType {
    /** The case id, `<PROVIDER>-<n>`. */
    @Field(() => ID)
    id!: string

    /** What the case proves. */
    @Field(() => String)
    label!: string

    /** `inbound` (the provider calls NIVO's webhook) or `outbound` (it answers an operation). */
    @Field(() => String)
    direction!: string

    /** The operation an outbound case answers; null for an inbound one. */
    @Field(() => String, { nullable: true })
    operation!: string | null

    /** True for the success case of an outbound operation. */
    @Field(() => Boolean)
    isDefault!: boolean

    /** The trigger an inbound case feeds; null for an outbound one. */
    @Field(() => String, { nullable: true })
    trigger!: string | null

    /** The inputs an inbound case takes. */
    @Field(() => [SandboxCaseInputFieldType])
    inputs!: ReadonlyArray<SandboxCaseInputFieldType>
}

@ObjectType()
/** One input value, as text (a number is its decimal text). */
export class SandboxInputValueType {
    /** The field name. */
    @Field(() => String)
    name!: string

    /** The value. */
    @Field(() => String)
    value!: string
}

@ObjectType()
/** The request the agent last made of a sandbox account, read as inputs. */
export class SandboxLatestRequestType {
    /** The operation it was made through. */
    @Field(() => String)
    operation!: string

    /** When it was made, ISO 8601. */
    @Field(() => String)
    at!: string

    /** The inputs it reads as. */
    @Field(() => [SandboxInputValueType])
    inputs!: ReadonlyArray<SandboxInputValueType>
}

@ObjectType()
/** The case an outbound operation answers next on an account. */
export class SandboxNextCaseType {
    /** The operation. */
    @Field(() => String)
    operation!: string

    /** The case id. */
    @Field(() => String)
    caseId!: string

    /** True when nothing is picked and the default (success) case answers. */
    @Field(() => Boolean)
    isDefault!: boolean
}

@ObjectType()
/** One call of the account's log. */
export class SandboxCallType {
    /** The call id. */
    @Field(() => ID)
    id!: string

    /** The operation. */
    @Field(() => String)
    operation!: string

    /** The key of the request. */
    @Field(() => String)
    key!: string

    /** When it was made, ISO 8601. */
    @Field(() => String)
    at!: string

    /** `answered` or `threw`. */
    @Field(() => String)
    outcome!: string

    /** The error code (else its name) when it threw. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** The request as JSON text. */
    @Field(() => String)
    requestJson!: string

    /** The answer as JSON text, when it answered. */
    @Field(() => String, { nullable: true })
    answerJson!: string | null
}

@ObjectType()
/** One run parked at a wait. */
export class SandboxWaitingRunType {
    /** The run. */
    @Field(() => ID)
    runId!: string

    /** The agent of the run. */
    @Field(() => ID)
    agentId!: string

    /** The agent's name, else its id. */
    @Field(() => String)
    agentLabel!: string

    /** The person's name, else an id of the person or the route, else an empty text. */
    @Field(() => String)
    personLabel!: string

    /** The route the run is about. */
    @Field(() => String, { nullable: true })
    routeId!: string | null

    /** What the wait listens for. */
    @Field(() => [String])
    waitsFor!: ReadonlyArray<string>

    /** The park key of the wait. */
    @Field(() => String)
    parkKey!: string

    /** When the wait's time runs out, ISO 8601. */
    @Field(() => String)
    dueAt!: string
}

@ObjectType()
/** A sandbox account just opened. */
export class OpenedSandboxAccountType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The account's sandbox key. */
    @Field(() => String)
    sandboxKey!: string
}

@ObjectType()
/** What NIVO's own route answered one webhook call of an inbound case. */
export class SandboxDeliveryType {
    /** The route that was called. */
    @Field(() => String)
    path!: string

    /** The HTTP status it answered. */
    @Field(() => Int)
    status!: number

    /** The body it answered, as JSON text; null when it answered none. */
    @Field(() => String, { nullable: true })
    bodyJson!: string | null
}

@ObjectType()
/** What sending one inbound case did. */
export class SandboxSendResultType {
    /** The case. */
    @Field(() => String)
    caseId!: string

    /** The inputs the payload was built from. */
    @Field(() => [SandboxInputValueType])
    inputs!: ReadonlyArray<SandboxInputValueType>

    /** Each webhook call, in order. */
    @Field(() => [SandboxDeliveryType])
    deliveries!: ReadonlyArray<SandboxDeliveryType>
}

@ObjectType()
/** How "expire this run's wait now" ended. */
export class SandboxWaitExpiryType {
    /** The run. */
    @Field(() => ID)
    runId!: string

    /** The engine's word: `admitted`. */
    @Field(() => String)
    outcome!: string
}
