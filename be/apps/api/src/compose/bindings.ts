import type { DynamicModule } from "@nestjs/common"
import { AppCommandsModule } from "@modules/domain/app-commands"
import { LIVENESS_ERROR_KINDS, LIVENESS_MESSAGES, LivenessModule } from "@modules/domain/liveness"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"

/** Register the app-wide system capabilities. */
export const systemCapabilities = (): Array<DynamicModule> => [
    AppCommandsModule.register({ isGlobal: true }),
    LivenessModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const bindingsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [LIVENESS_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const bindingsMessages: ReadonlyArray<MessageBundle> = [LIVENESS_MESSAGES]
