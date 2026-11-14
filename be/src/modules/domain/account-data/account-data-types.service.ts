import { Injectable } from "@nestjs/common"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { AccountDataTypeDef, AccountWriteMode, OptionalAccountDataTypeDef } from "./account-data.contracts"
import { byName } from "./account-data.policy"
import { AccountDataLogEvent } from "./account-data.log-events"
import { InjectAccountDataOptions } from "./account-data.port"
import type { AccountDataOptions } from "./account-data.options"
import { assertAccountDataType } from "./define-account-data-type.policy"
import { AccountDataError, AccountDataErrorCode } from "./errors/account-data.error"

/** The declarations by name, every one checked; a name declared twice is refused. */
const registryOf = (types: ReadonlyArray<AccountDataTypeDef>): ReadonlyMap<string, AccountDataTypeDef> => {
    const byType = new Map<string, AccountDataTypeDef>()
    for (const def of types) {
        assertAccountDataType(def)
        if (byType.has(def.name)) {
            throw new AccountDataError({
                code: AccountDataErrorCode.TypeInvalid,
                params: { type: def.name, problems: "name: declared twice in the catalog" },
            })
        }
        byType.set(def.name, def)
    }
    return byType
}

@Injectable()
/**
 * The declared account data types of the app, by name (the catalog the app registers the capability with). Built at boot: a
 * declaration that breaks its own rules, or a name declared twice, stops the app with a clear error.
 */
export class AccountDataTypesService {
    private readonly byType: ReadonlyMap<string, AccountDataTypeDef>

    constructor(
        @InjectAccountDataOptions() options: AccountDataOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {
        this.byType = registryOf(options.types)
    }

    /** The declaration of a type; null when it is not declared. */
    of(type: string): OptionalAccountDataTypeDef {
        return this.byType.get(type) ?? null
    }

    /** Every declaration, by name. */
    all(): ReadonlyArray<AccountDataTypeDef> {
        return [...this.byType.values()].sort((left, right) => byName(left.name, right.name))
    }

    /**
     * The declaration of a type the caller writes or reads: refused (TYPE_UNDECLARED, logged with type and provider, never a value) when
     * it is not declared, or when `provider` is given and the type is another provider's.
     */
    declared(type: string, provider?: string): AccountDataTypeDef {
        const def = this.of(type)
        if (def !== null && (provider === undefined || def.provider === null || def.provider === provider)) return def
        throw this.wiring(AccountDataErrorCode.TypeUndeclared, type, provider ?? def?.provider ?? "")
    }

    /** The declaration of a type that must be written in one of `modes`: refused (WRITE_MODE, logged) otherwise. */
    declaredAs(type: string, modes: ReadonlyArray<AccountWriteMode>, provider?: string): AccountDataTypeDef {
        const def = this.declared(type, provider)
        if (modes.includes(def.write)) return def
        throw this.wiring(AccountDataErrorCode.WriteMode, type, provider ?? def.provider ?? "")
    }

    /** A wiring error, logged before it is thrown: the type and the provider ("" when none), nothing of a value. */
    wiring(code: AccountDataErrorCode, type: string, provider: string): AccountDataError {
        const error = new AccountDataError({ code, params: { type, provider } })
        this.logger.error(AccountDataLogEvent.WiringRefused, error, { type, provider })
        return error
    }
}
