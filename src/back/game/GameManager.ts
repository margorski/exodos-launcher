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
import { GameManagerState, LoadPlatformError } from "./types";
import { EXODOS_GAMES_PLATFORM_NAME } from "@shared/constants";

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

export class GameManager {
    private _state: GameManagerState = {
        platforms: [],
        platformsPath: "",
    };

    public get platforms() {
        return this._state.platforms;
    }

    public get dosPlatform() {
        return this._state.platforms.find(
            (p) => p.name === EXODOS_GAMES_PLATFORM_NAME
        );
    }

    public async loadPlatforms(
        platformsPath: string,
        images: IThumbnailsInfo[]
    ): Promise<LoadPlatformError[]> {
        this._state.platformsPath = platformsPath;
        const platforms: GamePlatform[] = [];
        try {
            const libraryNames = await readdir(this._state.platformsPath);
            for (let libraryName of libraryNames) {
                // Check each library for platforms
                try {
                    const platformFile = path.join(
                        this._state.platformsPath,
                        libraryName
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
                        }
                    );
                    if (!LaunchBox.formatPlatformFileData(data)) {
                        throw new Error(
                            `Failed to parse XML file: ${platform.filePath}`
                        );
                    }

                    // Populate platform
                    platform.data = data;
                    platform.collection = GameParser.parse(
                        data,
                        platform.library
                    );
                    platform.collection.games.forEach((g) => {
                        const imagesForGame = images.find(
                            (i) => i.GameName == g.title
                        );
                        if (imagesForGame)
                            g.thumbnailPath = imagesForGame.BoxThumbnail;
                    });
                    // Success!
                    this._state.platforms.push(platform);
                } catch (e) {
                    errors.push({
                        ...copyError(e),
                        filePath: platform.filePath,
                    });
                }
            })
        );

        return errors;
    }

    public findPlatformByName(name: string): GamePlatform | undefined {
        return this._state.platforms.find((p) => p.name === name);
    }

    /** (Similar to Array.find(), but it looks through all platforms) */
    public findGame(
        predicate: (this: undefined, game: IGameInfo, index: number) => boolean
    ): IGameInfo | undefined {
        for (let i = 0; i < this._state.platforms.length; i++) {
            const game =
                this._state.platforms[i].collection.games.find(predicate);
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
        data: any
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
            data.LaunchBox.AdditionalApplication
        );

        return true;

        function isObject(obj: any): boolean {
            return typeof obj === "object" && data.LaunchBox !== null;
        }

        function convertEntitiesToArray(
            entries: any | any[] | undefined
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
}
