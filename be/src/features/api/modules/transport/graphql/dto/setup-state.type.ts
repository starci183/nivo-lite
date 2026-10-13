import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleInstallationType } from "./module-installation.type"
import { SetupCardViewType } from "./setup-card-view.type"
import { SetupMessageType } from "./setup-message.type"
import { SetupRevisionType } from "./setup-revision.type"
import { SetupSessionType } from "./setup-session.type"

@ObjectType()
/** Everything the Setup tab of one instance needs. */
export class SetupStateType {
    /** The instance. */
    @Field(() => ModuleInstallationType)
    installation!: ModuleInstallationType

    /** The open draft: new messages go here. */
    @Field(() => SetupSessionType)
    session!: SetupSessionType

    /** Every revision, oldest first. */
    @Field(() => [SetupRevisionType])
    revisions!: ReadonlyArray<SetupRevisionType>

    /** The whole chat across the revisions, oldest first. */
    @Field(() => [SetupMessageType])
    messages!: ReadonlyArray<SetupMessageType>

    /** The confirm cards of the chat. */
    @Field(() => [SetupCardViewType])
    cards!: ReadonlyArray<SetupCardViewType>

    /** True while NIVO has not answered the last message of the owner yet. */
    @Field()
    turnPending!: boolean
}
