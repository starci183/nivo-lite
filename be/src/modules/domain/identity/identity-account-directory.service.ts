import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AccountDirectory, AccountStanding } from "@modules/integrations/passport"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { authDoors } from "./persistence/auth-doors.port"

@Injectable()
/** The package's account directory over the account door: whether an account still stands, for a refresh to go on. */
export class IdentityAccountDirectoryService implements AccountDirectory {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The standing of one account, or undefined when it does not exist. */
    async find(userId: string): Promise<AccountStanding | undefined> {
        const user = await authDoors.userById(this.entityManager, userId)
        return user === undefined ? undefined : { id: user.id, email: user.email, disabled: user.disabled }
    }
}
