import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./account.module-definition"
import { GetAccountHandler } from "./application/get-account.handler"
import { ChangePasswordHandler } from "./application/change-password.handler"
import { LogoutOtherSessionsHandler } from "./application/logout-other-sessions.handler"
import { RequestMyAvatarUploadHandler } from "./application/request-my-avatar-upload.handler"
import { RevokeSessionHandler } from "./application/revoke-session.handler"
import { SetMyAvatarHandler } from "./application/set-my-avatar.handler"
import { UpdateProfileHandler } from "./application/update-profile.handler"

@Module({
    providers: [
        GetAccountHandler,
        RevokeSessionHandler,
        LogoutOtherSessionsHandler,
        ChangePasswordHandler,
        UpdateProfileHandler,
        RequestMyAvatarUploadHandler,
        SetMyAvatarHandler,
    ],
})
/** The account feature: the handlers of its application. */
export class AccountApiModule extends ConfigurableModuleClass {}
