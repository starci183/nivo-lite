import { Module } from "@nestjs/common"
import { GetCollageHandler } from "./application/get-collage.handler"
import { GetProductImageHandler } from "./application/get-product-image.handler"
import { ConfigurableModuleClass } from "./product-images.module-definition"

@Module({ providers: [GetProductImageHandler, GetCollageHandler] })
/** The product-images feature: the handler that reads the public photo of a product. */
export class ProductImagesApiModule extends ConfigurableModuleClass {}
