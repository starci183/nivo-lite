import { Module } from "@nestjs/common"
import { AccountApiModule } from "../../account.module"
import { ConfigurableModuleClass } from "./account-graphql.module-definition"
import { ChangePasswordResolver } from "./change-password.resolver"
import { LogoutOtherSessionsResolver } from "./logout-other-sessions.resolver"
import { MyAccountResolver } from "./my-account.resolver"
import { RequestMyAvatarUploadResolver } from "./request-my-avatar-upload.resolver"
import { RevokeSessionResolver } from "./revoke-session.resolver"
import { SetMyAvatarResolver } from "./set-my-avatar.resolver"
import { UpdateProfileResolver } from "./update-profile.resolver"

@Module({
    imports: [AccountApiModule.register({})],
    providers: [
        MyAccountResolver,
        RevokeSessionResolver,
        LogoutOtherSessionsResolver,
        ChangePasswordResolver,
        UpdateProfileResolver,
        RequestMyAvatarUploadResolver,
        SetMyAvatarResolver,
    ],
})
/** The GraphQL transport of the account feature. */
export class AccountGraphqlModule extends ConfigurableModuleClass {}
