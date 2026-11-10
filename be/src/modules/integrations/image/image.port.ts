/** The image port: the two things a collage of product photos needs, cropping a photo and drawing a vector page as a JPEG. */
export interface Image {
    /** The photo cut to a square of `side` pixels (the middle of it, turned upright by its own orientation) as JPEG bytes; rejects with an `ImageError` when the bytes are no image. */
    cropSquare(bytes: Buffer, side: number): Promise<Buffer>
    /** The SVG document drawn on a white page as JPEG bytes; rejects with an `ImageError` when the document cannot be drawn. */
    rasterise(svg: string): Promise<Buffer>
}
