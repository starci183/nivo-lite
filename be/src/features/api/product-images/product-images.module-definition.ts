import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProductImagesApiOptions } from "./product-images.options"

/** The configurable-module base of the product-images module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProductImagesApiOptions>()
