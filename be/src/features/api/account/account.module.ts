import { Module } from "@nestjs/common"
import { GetAccountHandler } from "./application/get-account.handler"
import { RevokeSessionHandler } from "./application/revoke-session.handler"
import { UpdateProfileHandler } from "./application/update-profile.handler"

@Module({ providers: [GetAccountHandler, RevokeSessionHandler, UpdateProfileHandler] })
/** The account feature: the handlers of its application. */
export class AccountApiModule {}
