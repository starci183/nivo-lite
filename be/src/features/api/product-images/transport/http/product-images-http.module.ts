import { Module } from "@nestjs/common"
import { ProductImagesApiModule } from "../../product-images.module"
import { ProductImageController } from "./product-image.controller"
import { ConfigurableModuleClass } from "./product-images-http.module-definition"

@Module({ imports: [ProductImagesApiModule.register({})], controllers: [ProductImageController] })
/** The HTTP transport of the product-images feature: the public address of a product photo. */
export class ProductImagesHttpModule extends ConfigurableModuleClass {}
