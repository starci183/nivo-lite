import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./account.module-definition"
import { GetAccountHandler } from "./application/get-account.handler"
import { RequestMyAvatarUploadHandler } from "./application/request-my-avatar-upload.handler"
import { RevokeSessionHandler } from "./application/revoke-session.handler"
import { SetMyAvatarHandler } from "./application/set-my-avatar.handler"
import { UpdateProfileHandler } from "./application/update-profile.handler"

@Module({
    providers: [
        GetAccountHandler,
        RevokeSessionHandler,
        UpdateProfileHandler,
        RequestMyAvatarUploadHandler,
        SetMyAvatarHandler,
    ],
})
/** The account feature: the handlers of its application. */
export class AccountApiModule extends ConfigurableModuleClass {}
