import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProductImagesHttpOptions } from "./product-images-http.options"

/** The configurable-module base of the product-images-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProductImagesHttpOptions>()
