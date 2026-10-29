import { Body, Controller, Get, HttpCode, Post, Query, Redirect, Req, Res } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { Request, Response } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import type { AccessGrant, GoogleRedirect } from "@modules/domain/identity"
import type { JwksDocument } from "@modules/integrations/passport"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ConfirmCommand } from "../../application/confirm.command"
import { ForgotCommand } from "../../application/forgot.command"
import { GetJwksQuery } from "../../application/get-jwks.query"
import { GoogleBeginCommand } from "../../application/google-begin.command"
import { GoogleCompleteCommand } from "../../application/google-complete.command"
import { LoginCommand } from "../../application/login.command"
import { LogoutCommand } from "../../application/logout.command"
import { RefreshCommand } from "../../application/refresh.command"
import { ResendCommand } from "../../application/resend.command"
import { ResetCommand } from "../../application/reset.command"
import { SessionCommand } from "../../application/session.command"
import { SignupCommand } from "../../application/signup.command"
import { ConfirmRequest } from "./dto/confirm.request"
import { EmailRequest } from "./dto/email.request"
import { GoogleStartRequest } from "./dto/google-start.request"
import { LoginRequest } from "./dto/login.request"
import { ResetRequest } from "./dto/reset.request"
import { SignupRequest } from "./dto/signup.request"

@Controller("auth")
/** The cookie doors of sign-in: email and password, signup, Google, refresh, sign-out, emailed links and the public keys. */
export class AuthController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Signs in with email and password; the refresh token is set as an httpOnly cookie. */
    @Post("login")
    @HttpCode(200)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    login(
        @Body() _body: LoginRequest,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AccessGrant> {
        return this.commandBus.execute(new LoginCommand({ request: { exchange: { req, res } } }))
    }

    /** Creates an unconfirmed account and mails its confirmation link; the answer is the same for an address that already has one. */
    @Post("signup")
    @HttpCode(202)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    signup(@Body() body: SignupRequest): Promise<void> {
        return this.commandBus.execute(new SignupCommand({ request: body }))
    }

    /** Mails the confirmation link again. */
    @Post("resend")
    @HttpCode(202)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    resend(@Body() body: EmailRequest): Promise<void> {
        return this.commandBus.execute(new ResendCommand({ request: body }))
    }

    /** Spends a confirmation link. */
    @Post("confirm")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    confirm(@Body() body: ConfirmRequest): Promise<void> {
        return this.commandBus.execute(new ConfirmCommand({ request: body }))
    }

    /** Rotates the refresh cookie and answers a new access token; a bad cookie is cleared. */
    @Post("refresh")
    @HttpCode(200)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AccessGrant> {
        return this.commandBus.execute(new RefreshCommand({ request: { exchange: { req, res } } }))
    }

    /** Answers a fresh access token for the cookie session WITHOUT rotating the cookie, so parallel requests of one browser never race. */
    @Get("session")
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    session(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AccessGrant> {
        return this.commandBus.execute(new SessionCommand({ request: { exchange: { req, res } } }))
    }

    /** Ends the session of the refresh cookie and clears it. */
    @Post("logout")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        return this.commandBus.execute(new LogoutCommand({ request: { exchange: { req, res } } }))
    }

    /** Emails a password link; the answer is the same whether or not the address has an account. */
    @Post("forgot")
    @HttpCode(202)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    forgot(@Body() body: EmailRequest): Promise<void> {
        return this.commandBus.execute(new ForgotCommand({ request: body }))
    }

    /** Spends a password link and sets the new password; the person signs in afterwards. */
    @Post("reset")
    @HttpCode(204)
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    reset(@Body() body: ResetRequest): Promise<void> {
        return this.commandBus.execute(new ResetCommand({ request: body }))
    }

    /** Sends the browser to Google (authorization code with state and PKCE); `returnTo` is an absolute address on the web origin or a path. */
    @Get("google")
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    google(@Query() _query: GoogleStartRequest, @Req() req: Request, @Res() res: Response): Promise<void> {
        return this.commandBus.execute(new GoogleBeginCommand({ request: { exchange: { req, res } } }))
    }

    /** Google sends the browser back here; the session cookie is set and the browser lands on the web app (or its sign-in page on failure). */
    @Get("google/callback")
    @Redirect()
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<GoogleRedirect> {
        return this.commandBus.execute(new GoogleCompleteCommand({ request: { exchange: { req, res } } }))
    }

    /** The public keys access tokens verify against. */
    @Get("jwks")
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    jwks(): Promise<JwksDocument> {
        return this.queryBus.execute(new GetJwksQuery({ request: {} }))
    }
}
