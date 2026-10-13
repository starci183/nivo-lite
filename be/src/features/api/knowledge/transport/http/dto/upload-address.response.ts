/** An address a browser uploads one document to. */
export class UploadAddressResponse {
    /** The object path to give back when the document is added. */
    path!: string
    /** The one-time upload token. */
    token!: string
    /** The signed address to PUT the file to. */
    signedUrl!: string
}
