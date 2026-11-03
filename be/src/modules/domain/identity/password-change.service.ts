import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { isAcceptablePassword, isPresentablePassword, normalizeEmail } from "@modules/integrations/passport"
import type { AuthPasswords, SignInBudget } from "@modules/integrations/passport"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Principal } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { refusing } from "./auth-refusal.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import { InjectAuthPasswords, InjectSignInBudget } from "./identity.decorators"
import { accountDoors } from "./persistence/account-doors.port"

@Injectable()
/** The password change of a signed-in person: the current password is proved against the sign-in budget before the new one is stored. */
export class IdentityPasswordChangeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAuthPasswords() private readonly passwords: AuthPasswords,
        @InjectSignInBudget() private readonly budget: SignInBudget,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Changes the password of a signed-in person who proves the current one. */
    async change(principal: Principal, current: string, next: string): Promise<void> {
        const { id: userId, email } = principal
        if (email === undefined) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        if (!isAcceptablePassword(next)) throw new IdentityError({ code: IdentityErrorCode.PasswordInvalid })
        const address = normalizeEmail(email)
        const proved = await refusing(() =>
            this.budget.counted("login", address, async () => {
                const user = await accountDoors.userByEmail(this.entityManager, address)
                const matches = await this.passwords.verify(
                    isPresentablePassword(current) ? current : "",
                    user?.encrypted_password ?? "",
                )
                const passed = user?.id === userId && matches
                return { passed, value: passed }
            }),
        )
        if (!proved) throw new IdentityError({ code: IdentityErrorCode.PairRefused })
        await accountDoors.setPassword(
            this.entityManager,
            userId,
            await this.passwords.hash(next),
            false,
            this.clock.now(),
        )
    }
}
