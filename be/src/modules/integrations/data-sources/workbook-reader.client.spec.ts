import { Test } from "@nestjs/testing"
import { WorkbookReaderClient } from "./workbook-reader.client"

/** A real workbook of two sheets, First (Name / An) and Second (Name / Bo), as the bytes of an .xlsx file. */
const TWO_SHEETS = Buffer.from(
    [
        "UEsDBBQAAAAIABGnTV3xqbA++gAAAKQCAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLWSsU7DMBCGX8XyWsVOOyCEknYoMAJDeQDj",
        "XBIr9p3lc0N4e5S0YkAFhATTDfff/33DVbspeDFCYkdYy7UqpQC01Djsavl8uC+u5W5bHd4isJiCR65ln3O80ZptD8Gwogg4Bd9S",
        "CiazotTpaOxgOtCbsrzSljAD5iLPHXJb3UJrjj6LuykDnrAJPEuxPwVnVi1NjN5Zkx2hHrH5RCnOBJXALxnuXeTVFLzUFwnz5mvA",
        "+e5xhJRcA+LJpPxgAtRST16/UhpeiAb1fckFS2pbZ6EhewyAWXFMYBruAXLwapkqGIern/k8h1kvY/3HIh/9v/TY/LeHXt5u+w5Q",
        "SwMEFAAAAAgAEadNXRxJ976kAAAAFgEAAAsAAABfcmVscy8ucmVsc43PsQ7CIBSF4VchdxeqgzGmtIsx6WrqAyC9bUmBSwAV397V",
        "Ggf3k+/kr9viLHtgTIa8hC2vgKHXNBg/Sbj2580B2qa+oFXZkE+zCYkVZ32SMOccjkIkPaNTiVNAX5wdKTqVE6c4iaD0oiYUu6ra",
        "i/hpwNpk3SAhdsMWWP8K+I9N42g0nkjfHfr84+JrAaxXccIsoVjxpLjciBZenAXR1GIV2LwBUEsDBBQAAAAIABGnTV2JactYvgAA",
        "ADcBAAAPAAAAeGwvd29ya2Jvb2sueG1sjZDBasMwEER/Rey9lu1DKcZyLiWQc9MPUKV1LCLtml019eeXJg2kt54GhscbmHG3lWwu",
        "KJqYHHRNCwYpcEx0cvB+3D+9wG4av1jOH8xns5VM6mCpdR2s1bBg8drwirSVPLMUX7VhOVldBX3UBbGWbPu2fbbFJ4KbYZD/OHie",
        "U8BXDp8Fqd4kgtnXxKRLWhWm8bqgv2nIF3SwT6IVzLU6RAcdGBlSdCCH2IH9C79hYIoPdP9A9z+0vW/Y+w3TN1BLAwQUAAAACAAR",
        "p01dims7GrMAAACkAQAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzvZDBqsIwEEV/JczeTtuFyMPoRgS3Uj8gpNM2mGRC",
        "Jmr9e0Hw8QQXb+Xqwl2ce7jr7Ry8ulIWx1FDU9WgKFruXRw1nLr9YgXbzfpI3hTHUSaXRM3BR9EwlZJ+EMVOFIxUnCjOwQ+cgylS",
        "cR4xGXs2I2Fb10vMfxnwzlSHXkM+9A2o7p7oP2weBmdpx/YSKJYPE3jjfJaJqIDqTB6paPitBJ/RVHPwgJ9l2i/LtC8ZfLt78wBQ",
        "SwMEFAAAAAgAEadNXQ6ZTryyAAAAFgEAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWx1j81qw0AMhF9l0b2W7UMoRasQCD32",
        "0vYBFkeNl+6P0YrYj1+Sg+mhvc0MzMcMHbec3E20xVo8DF0PTspUL7FcPXx+vD49w5FprfrdZhFzW06leZjNlhfENs2SQ+vqImXL",
        "6atqDta6qldsi0q4PEo54dj3B8whFmB6ZOdggUnr6tTDAEzTXZwGcOYhlhSLvJsCU2xMxm8hC6Ex4d3jxIRa1x0w7oDxH8Cp/FXH",
        "X1twP8k/UEsDBBQAAAAIABGnTV35362pswAAABYBAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sdY/BasMwEER/Rey9XtuH",
        "UMpqQ0vpsZe2HyCcbSwiaY20xP78khxMD+1tZmAeM3TccnJXqS1q8TB0PTgpk55iOXv4+nx7eIQj06r10mYRc1tOpXmYzZYnxDbN",
        "kkPrdJGy5fStNQdrndYztqVKON1LOeHY9wfMIRZgumevwQJT1dVVDwMwTTfxPIAzD7GkWOTDKjDFxmT8HrIQGhPePE5MWHXdAeMO",
        "GP8BvOhfdfy1BfeT/ANQSwECFAAUAAAACAARp01d8amwPvoAAACkAgAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNd",
        "LnhtbFBLAQIUABQAAAAIABGnTV0cSfe+pAAAABYBAAALAAAAAAAAAAAAAACAASsBAABfcmVscy8ucmVsc1BLAQIUABQAAAAIABGn",
        "TV2JactYvgAAADcBAAAPAAAAAAAAAAAAAACAAfgBAAB4bC93b3JrYm9vay54bWxQSwECFAAUAAAACAARp01dims7GrMAAACkAQAA",
        "GgAAAAAAAAAAAAAAgAHjAgAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECFAAUAAAACAARp01dDplOvLIAAAAWAQAAGAAA",
        "AAAAAAAAAAAAgAHOAwAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsBAhQAFAAAAAgAEadNXfnframzAAAAFgEAABgAAAAAAAAA",
        "AAAAAIABtgQAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbFBLBQYAAAAABgAGAIsBAACfBQAAAAA=",
    ].join(""),
    "base64",
)

const paddedWorkbook = new Uint8Array(TWO_SHEETS.byteLength + 8).fill(0xff)
paddedWorkbook.set(TWO_SHEETS, 5)
const workbookView = paddedWorkbook.subarray(5, paddedWorkbook.byteLength - 3)

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [WorkbookReaderClient] }).compile()
    return moduleRef.get(WorkbookReaderClient)
}

describe("WorkbookReaderClient", () => {
    it.each([
        { name: "workbook bytes", bytes: TWO_SHEETS },
        { name: "a workbook byte view", bytes: workbookView },
    ])("reads both sheets from $name", async ({ bytes }) => {
        const client = await build()

        await expect(client.read(bytes)).resolves.toEqual([
            { sheet: "First", data: [["Name"], ["An"]] },
            { sheet: "Second", data: [["Name"], ["Bo"]] },
        ])
    })
})
