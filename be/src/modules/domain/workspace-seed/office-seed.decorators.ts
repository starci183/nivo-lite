import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OfficeAuthorityPort } from "./office-seed.port"

/** Token of the authority capability behind an office run. */
export const SEED_OFFICE_AUTHORITY: unique symbol = Symbol("domain.workspace-seed.office-authority")

/** Injects the authority capability. Parameter type: OfficeAuthorityPort. */
export const InjectSeedOfficeAuthority = (): TypedParameterDecorator<OfficeAuthorityPort> =>
    injector<OfficeAuthorityPort>(SEED_OFFICE_AUTHORITY)
