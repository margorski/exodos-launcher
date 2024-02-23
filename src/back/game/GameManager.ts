import { GameParser } from "@shared/game/GameParser";
import { IGameInfo } from "@shared/game/interfaces";
import {
    GamePlatform,
    IRawPlatformFile,
    IThumbnailsInfo,
} from "@shared/platform/interfaces";
import * as fastXmlParser from "fast-xml-parser";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { copyError } from "../util/misc";
import {
    GameManagerState,
    LoadPlatformError,
} from "./types";

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

export namespace GameManager {
    export async function loadPlatforms(
        state: GameManagerState,
        images: IThumbnailsInfo[],
    ): Promise<LoadPlatformError[]> {
        // Find the paths of all platform files
        const platforms: GamePlatform[] = [];
        try {
            const libraryNames = await readdir(state.platformsPath);
            for (let libraryName of libraryNames) {
                // Check each library for platforms
                try {
                    const platformFile = path.join(
                        state.platformsPath,
                        libraryName,
                    );
                    const platformFileExt = path.extname(platformFile);
                    if (
                        platformFileExt.toLowerCase().endsWith(".xml") &&
                        (await stat(platformFile)).isFile()
                    ) {
                        platforms.push({
                            name: path.basename(platformFile, platformFileExt),
                            filePath: platformFile,
                            library: libraryName,
                            data: {
                                LaunchBox: {
                                    Game: [],
                                    AdditionalApplication: [],
                                },
                            },
                            collection: {
                                games: [],
                                additionalApplications: [],
                            },
                        });
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        } catch (e) {
            console.error(e);
        }

        // Read and parse all platform files
        const errors: LoadPlatformError[] = [];
        await Promise.all(
            platforms.map(async (platform) => {
                try {
                    const content = await readFile(platform.filePath);
                    const data: any | undefined = fastXmlParser.parse(
                        content.toString(),
                        {
                            ignoreAttributes: true,
                            ignoreNameSpace: true,
                            parseNodeValue: true,
                            parseAttributeValue: false,
                            parseTrueNumberOnly: true,
                            // @TODO Look into which settings are most appropriate
                        },
                    );
                    if (!LaunchBox.formatPlatformFileData(data)) {
                        throw new Error(
                            `Failed to parse XML file: ${platform.filePath}`,
                        );
                    }

                    // Populate platform
                    platform.data = data;
                    platform.collection = GameParser.parse(
                        data,
                        platform.library,
                    );
                    platform.collection.games.forEach((g) => {
                        const imagesForGame = images.find(
                            (i) => i.GameName == g.title,
                        );
                        if (imagesForGame)
                            g.thumbnailPath = imagesForGame.BoxThumbnail;
                    });
                    // Success!
                    state.platforms.push(platform);
                } catch (e) {
                    errors.push({
                        ...copyError(e),
                        filePath: platform.filePath,
                    });
                }
            }),
        );

        return errors;
    }

    /** (Similar to Array.find(), but it looks through all platforms) */
    export function findGame(
        platforms: GamePlatform[],
        predicate: (this: undefined, game: IGameInfo, index: number) => boolean,
    ): IGameInfo | undefined {
        for (let i = 0; i < platforms.length; i++) {
            const game = platforms[i].collection.games.find(predicate);
            if (game) {
                return game;
            }
        }
    }
}

export namespace LaunchBox {
    /**
     * Format the result of "fast-xml-parser" into a structured object.
     * This ensures that all types that will be used exists and is of the proper type.
     * @param data Object to format.
     */
    export function formatPlatformFileData(
        data: any,
    ): data is IRawPlatformFile {
        if (!isObject(data)) {
            return false;
        }

        // If there are multiple "LaunchBox" elements, remove all but the first (There should never be more than one!)
        if (Array.isArray(data.LaunchBox)) {
            data.LaunchBox = data.LaunchBox[0];
        }

        if (!isObject(data.LaunchBox)) {
            data.LaunchBox = {};
        }

        data.LaunchBox.Game = convertEntitiesToArray(data.LaunchBox.Game);
        data.LaunchBox.AdditionalApplication = convertEntitiesToArray(
            data.LaunchBox.AdditionalApplication,
        );

        return true;

        function isObject(obj: any): boolean {
            return typeof obj === "object" && data.LaunchBox !== null;
        }

        function convertEntitiesToArray(
            entries: any | any[] | undefined,
        ): any[] {
            if (Array.isArray(entries)) {
                // Multiple entries
                return entries;
            } else if (entries) {
                // One entry
                return [entries];
            } else {
                // No entries
                return [];
            }
        }
    }

    /**
     * Remove all games with the given ID.
     * @param data Data to remove games from.
     * @param gameId ID of the game(s) to remove.
     * @returns Indices of all removed games.
     */
    export function removeGame(
        data: IRawPlatformFile,
        gameId: string,
    ): number[] {
        const indices: number[] = [];
        const games = data.LaunchBox.Game;
        for (let i = games.length - 1; i >= 0; i--) {
            if (games[i].ID === gameId) {
                indices.push(i);
                games.splice(i, 1);
            }
        }
        return indices;
    }

    /**
     * Remove all add-apps that belongs to the game with the given ID.
     * @param data Data to remove add-apps from.
     * @param gameId ID of the game the add-apps belong to.
     * @returns Indices of all removed add-apps (result[addapp_id] = addapp_index).
     */
    export function removeAddAppsOfGame(
        data: IRawPlatformFile,
        gameId: string,
    ): Record<string, number> {
        const indices: Record<string, number> = {};
        const addApps = data.LaunchBox.AdditionalApplication;
        for (let i = addApps.length - 1; i >= 0; i--) {
            if (addApps[i].GameID === gameId) {
                indices[addApps[i].Id] = i;
                addApps.splice(i, 1);
            }
        }
        return indices;
    }
}

/**
 * Copy an array and remove all duplicates of values.
 * All values that are strictly equal to another value will be removed, except for the one with the lowest index.
 * Example: [1, 2, 3, 1] => [1, 2, 3]
 */
function removeDupes<T>(array: T[]): T[] {
    const result = array.slice();
    for (let i = 0; i < result.length; i++) {
        const a = result[i];
        let j = i + 1;
        while (j < result.length) {
            if (result[j] === a) {
                result.splice(j, 1);
            } else {
                j++;
            }
        }
    }
    return result;
}
