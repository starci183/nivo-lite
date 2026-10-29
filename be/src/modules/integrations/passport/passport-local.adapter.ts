import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-local"
import type { AuthSubject, PassportAuthenticator } from "./passport.contracts"
import { InjectPassportAuthenticator } from "./passport.decorators"

@Injectable()
/** The email and password strategy; the domain decides whether the pair is right. */
export class PassportLocalStrategy extends PassportStrategy(Strategy, "local") {
    constructor(@InjectPassportAuthenticator() private readonly authenticator: PassportAuthenticator) {
        super({ usernameField: "email", passwordField: "password", session: false })
    }

    /** Called by passport with the posted pair; answers the person or throws the domain refusal. */
    validate(email: string, password: string): Promise<AuthSubject> {
        return this.authenticator.verifyPassword(email, password)
    }
}
