import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ApiKeyAuthAnswer, ApiPrincipal, ApiScope } from "./api-keys.contracts"
import { admitKey, bearerKey, hashKey } from "./api-keys.policy"
import { ApiKeysError, ApiKeysErrorCode } from "./errors/api-keys.error"
import { API_KEY_AUTH } from "./persistence/api-keys.sql"

@Injectable()
/** The workspace API keys reached only through the shared primary EntityManager: the admission of a public API request. */
export class ApiKeysService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Admits a public API request: the bearer key must exist, work, stay inside its minute budget and carry `scope`. The lookup,
     * the rate hit and the last-use stamp are one statement.
     */
    async authenticate(scope: ApiScope, authorization = ""): Promise<ApiPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const [row] = await this.entityManager.query<Array<{ auth: ApiKeyAuthAnswer | null }>>(API_KEY_AUTH, [
            hashKey(key),
        ])
        const admitted = admitKey(row?.auth ?? null, scope, this.clock.now())
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        return admitted.value
    }
}
