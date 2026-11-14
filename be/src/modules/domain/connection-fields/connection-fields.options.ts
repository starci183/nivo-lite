import type { Type } from "@nestjs/common"
import type { ConnectionFieldWriter } from "./connection-fields.contracts"

/** What the app hands the connection form capability. */
export interface ConnectionFieldsOptions {
    /**
     * The writer classes of the providers whose connection form is editable. Each is a provider of a global module of the app (the
     * provider's own capability); this capability injects them from the global container, never constructs one.
     */
    readonly writers?: ReadonlyArray<Type<ConnectionFieldWriter>>
}
