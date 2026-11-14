import type { DynamicModule } from "@nestjs/common"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { GraphqlModule } from "@modules/platform/graphql"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The automations area of the API, in registration order. */
export const automationsModules = (): Array<DynamicModule> => [
    HttpModule.register({ isGlobal: true }),
    GraphqlModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const automationsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    HTTP_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const automationsMessages: ReadonlyArray<MessageBundle> = [
    HTTP_MESSAGES,
]
