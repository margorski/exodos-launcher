import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";

export interface MediaFolder {
    type: string;
    path: string;
    platform: string;
}

export interface PlatformsFile {
    platforms: string[];
    media: MediaFolder[];
}

/**
 * Read and parse the file asynchronously.
 * @param filePath Path of the file.
 */
export function readPlatformsFile(filePath: string): Promise<PlatformsFile> {
    console.log(`Reading Platforms.xml file in the ${filePath} directory`);
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (error, data) => {
            if (error) {
                reject(error);
            } else {
                let parsed: any;
                try {
                    const parser = new XMLParser();
                    parsed = parser.parse(data.toString());
                } catch {
                    parsed = {};
                }
                resolve(parsePlatformsFile(parsed.LaunchBox || {}));
            }
        });
    });
}

function parsePlatformsFile(data: any): PlatformsFile {
    const platformsRaw = data.Platform
        ? Array.isArray(data.Platform)
            ? data.Platform
            : [data.Platform]
        : [];
    const platforms = platformsRaw
        .map((platform: any) => platform.Name ?? "")
        // Fix for the Magazines which have incorrect encoding of the ampersand character
        .map((p: string) => p.replace("&amp;", "&"))
        .filter((p: string) => !!p);

    const mediaRaw = data.PlatformFolder
        ? Array.isArray(data.PlatformFolder)
            ? data.PlatformFolder
            : [data.PlatformFolder]
        : [];
    const media = mediaRaw
        .map((m: any) => {
            return {
                type: m.MediaType,
                path: m.FolderPath,
                platform: m.Platform,
            } as MediaFolder;
        })
        .filter((m: MediaFolder) => !!m.path && !!m.platform);
    return { platforms, media };
}
