import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { TemplateFiles } from "./template-files.contracts"
import type { TemplateFilesOptions } from "./template-files.options"

/** Token of the template files options. */
export const TEMPLATE_FILES_OPTIONS: unique symbol = Symbol("integrations.template-files.options")
/** Token of the template files. */
export const TEMPLATE_FILES: unique symbol = Symbol("integrations.template-files.files")

/** Injects the template files. Parameter type: TemplateFiles. */
export const InjectTemplateFiles = (): TypedParameterDecorator<TemplateFiles> => injector<TemplateFiles>(TEMPLATE_FILES)

/** Injects the template files options. Parameter type: TemplateFilesOptions. */
export const InjectTemplateFilesOptions = (): TypedParameterDecorator<TemplateFilesOptions> =>
    injector<TemplateFilesOptions>(TEMPLATE_FILES_OPTIONS)
