import { readJsonFile } from "@shared/Util";

const platformOptionsFilename = "./platform_options.json";

export interface PlatformOptions {
    name: string;
    watchable: boolean;
}

export const DefaultPlatformOptions = {
    name: "",
    watchable: false,
};

export let platformOptions: PlatformOptions[] | null;

const init = async () => {
    console.log("Loading platform options file...");
    try {
        platformOptions = await readJsonFile(platformOptionsFilename);
    } catch (e) {
        const errorMessage = (e as any)?.message ?? e;
        console.error(
            `Cannot load platform options file. Error: ${errorMessage}`
        );
    }
};
init();
