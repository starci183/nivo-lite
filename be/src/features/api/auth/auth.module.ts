import { Module } from "@nestjs/common"
import { ChangePasswordHandler } from "./application/change-password.handler"
import { ConfirmHandler } from "./application/confirm.handler"
import { ForgotHandler } from "./application/forgot.handler"
import { GetJwksHandler } from "./application/get-jwks.handler"
import { GoogleBeginHandler } from "./application/google-begin.handler"
import { GoogleCompleteHandler } from "./application/google-complete.handler"
import { LoginHandler } from "./application/login.handler"
import { LogoutHandler } from "./application/logout.handler"
import { LogoutOthersHandler } from "./application/logout-others.handler"
import { RefreshHandler } from "./application/refresh.handler"
import { ResendHandler } from "./application/resend.handler"
import { ResetHandler } from "./application/reset.handler"
import { SessionHandler } from "./application/session.handler"
import { SignupHandler } from "./application/signup.handler"
import { ConfigurableModuleClass } from "./auth.module-definition"

@Module({
    providers: [
        ChangePasswordHandler,
        ConfirmHandler,
        ForgotHandler,
        GetJwksHandler,
        GoogleBeginHandler,
        GoogleCompleteHandler,
        LoginHandler,
        LogoutHandler,
        LogoutOthersHandler,
        RefreshHandler,
        ResendHandler,
        ResetHandler,
        SessionHandler,
        SignupHandler,
    ],
})
/** The auth feature: the handlers behind the sign-in doors. */
export class AuthApiModule extends ConfigurableModuleClass {}
