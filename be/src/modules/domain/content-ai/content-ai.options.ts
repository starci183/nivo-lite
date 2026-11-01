/** Options of the content capability (AI Marketing), given by the app root. */
export interface ContentAiOptions {
    /** The provider token of the file store that writes objects (a `MarketingAssets`, bound to the object-storage door). */
    readonly assets: symbol
    /** Where the bundled fonts live (the video renderer's fonts directory). */
    readonly fontsDir: string
    /** The scratch directory the brand images are composed in. */
    readonly workDir: string
}
