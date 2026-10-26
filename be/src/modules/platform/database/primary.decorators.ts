import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import type { AfterCommit } from "./after-commit.port"
import type { RateLimitStore } from "./rate-limit-store.port"

/** Token of the shared EntityManager of the `primary` database; the database module provides it for the connection it opens. */
export const PRIMARY_ENTITY_MANAGER: unique symbol = Symbol("platform.database.primary-entity-manager")

/** Injects the shared EntityManager of the `primary` database. Parameter type: EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(PRIMARY_ENTITY_MANAGER)

/** Token of the shared fixed-window rate-limit counter. */
export const RATE_LIMIT_STORE: unique symbol = Symbol("platform.database.rate-limit-store")

/** Injects the shared PostgreSQL rate-limit store. Parameter type: RateLimitStore. */
export const InjectRateLimitStore = (): TypedParameterDecorator<RateLimitStore> =>
    injector<RateLimitStore>(RATE_LIMIT_STORE)

/** Token of the after-commit capability. */
export const AFTER_COMMIT: unique symbol = Symbol("platform.database.after-commit")

/** Injects the after-commit capability. Parameter type: AfterCommit. */
export const InjectAfterCommit = (): TypedParameterDecorator<AfterCommit> => injector<AfterCommit>(AFTER_COMMIT)
