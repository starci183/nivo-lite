import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ErrorsOptions } from "./errors.options"
import type { ErrorReporter } from "./errors.port"
import type { ErrorsService } from "./errors.service"

/** Token of the errors options, exported so a spec can provide it. */
export const ERRORS_OPTIONS: unique symbol = Symbol("platform.errors.options")

/** Token of the service that describes failures for the transports. */
export const ERRORS_SERVICE: unique symbol = Symbol("platform.errors.service")

/** Injects the options of the errors capability. Parameter type: ErrorsOptions. */
export const InjectErrorsOptions = (): TypedParameterDecorator<ErrorsOptions> => injector<ErrorsOptions>(ERRORS_OPTIONS)

/** Injects the service that describes failures for the transports. Parameter type: ErrorsService. */
export const InjectErrorsService = (): TypedParameterDecorator<ErrorsService> => injector<ErrorsService>(ERRORS_SERVICE)

/** Token of the error reporter (the `app_errors` writer the app root binds). */
export const ERROR_REPORTER: unique symbol = Symbol("platform.errors.reporter")

/** Injects the error reporter. Parameter type: ErrorReporter. */
export const InjectErrorReporter = (): TypedParameterDecorator<ErrorReporter> => injector<ErrorReporter>(ERROR_REPORTER)
