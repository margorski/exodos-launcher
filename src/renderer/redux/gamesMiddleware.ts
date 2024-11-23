import { isAnyOf } from "@reduxjs/toolkit";
import { readPlatformsFile } from "@renderer/file/PlatformFile";
import { formatPlatformFileData } from "@renderer/util/LaunchBoxHelper";
import { GameParser } from "@shared/game/GameParser";
import * as fs from "fs";
import * as fsasync from "fs/promises";
import * as path from "path";
import {
    GamesInitState,
    initialize,
    setGames,
    setLibraries,
} from "./gamesSlice";
import { startAppListening } from "./listenerMiddleware";
import { initializeViews } from "./searchSlice";
import { IGameCollection } from "@shared/game/interfaces";
import { GameCollection } from "@shared/game/GameCollection";
import {
    createVideosWatcher,
    loadPlatformImages,
    loadPlatformVideos,
    mapGamesMedia,
} from "@renderer/util/media";
import { createManualsWatcher } from "@renderer/util/addApps";
import { createGamesWatcher } from "@renderer/util/games";
import { XMLParser } from "fast-xml-parser";
import {
    DefaultPlatformOptions,
    platformOptions,
} from "@renderer/util/PlatformOptions";

export function addGamesMiddleware() {
    startAppListening({
        matcher: isAnyOf(initialize),
        effect: async (_action, listenerApi) => {
            const state = listenerApi.getState();
            if (state.gamesState.initState === GamesInitState.LOADED) {
                return; // Already loaded
            }

            const startTime = Date.now();
            const libraries: string[] = [];
            const collection: GameCollection = new GameCollection();

            const platformsPath = path.join(
                window.External.config.fullExodosPath,
                window.External.config.data.platformFolderPath
            );
            const { platforms } = await readPlatformsFile(
                path.join(platformsPath, "../Platforms.xml")
            );

            for (const platform of platforms) {
                try {
                    const platformCollection = await loadPlatform(
                        platform,
                        platformsPath
                    );
                    if (platformCollection.games.length > 0) {
                        libraries.push(platform);
                    }
                    collection.push(platformCollection);

                    const optionsForPlatform =
                        platformOptions?.find((p) => p.name === platform) ??
                        DefaultPlatformOptions;
                    if (optionsForPlatform.watchable) {
                        createGamesWatcher(platformCollection);
                        createVideosWatcher(platform);
                        createManualsWatcher(platform);
                    }
                } catch (err) {
                    console.error(`Failed to load platform ${err}`);
                }
            }
            console.debug(`Load time - ${Date.now() - startTime}ms`);
            libraries.sort();
            listenerApi.dispatch(setLibraries(libraries));
            listenerApi.dispatch(initializeViews(libraries));
            listenerApi.dispatch(setGames(collection.forRedux()));
        },
    });
}

async function loadPlatform(platform: string, platformsPath: string) {
    console.log(`Loading platform ${platform} from ${platformsPath}`);

    try {
        const platformFileCaseInsensitive =
            await findPlatformFileCaseInsensitive(
                `${platform}.xml`,
                platformsPath
            );
        const platformFile = path.join(
            platformsPath,
            platformFileCaseInsensitive
        );

        if ((await fs.promises.stat(platformFile)).isFile()) {
            console.debug(`Platform file found: ${platformFile}`);

            const content = await fs.promises.readFile(platformFile, {
                encoding: "utf-8",
            });

            const parser = new XMLParser({
                numberParseOptions: {
                    leadingZeros: true,
                    eNotation: true,
                    hex: false,
                },
                tagValueProcessor: (
                    tagName,
                    tagValue,
                    _jPath,
                    _hasAttributes,
                    _isLeafNode
                ) => {
                    if (tagName === "CommandLine") {
                        return null;
                    }
                    return tagValue;
                },
            });
            const data: any | undefined = parser.parse(content.toString());

            if (!formatPlatformFileData(data)) {
                throw new Error(`Failed to parse XML file: ${platformFile}`);
            }

            const startTime = Date.now();
            const images = await loadPlatformImages(platform);
            console.log(`Images - ${Date.now() - startTime}`);
            const videos = loadPlatformVideos(platform);
            console.log(`Videos - ${Date.now() - startTime}`);

            const platformCollection = GameParser.parse(
                data,
                platform,
                window.External.config.fullExodosPath
            );

            console.log(`Parsing - ${Date.now() - startTime}`);

            for (const game of platformCollection.games) {
                mapGamesMedia(game, images, videos);
            }

            console.log(`Add apps - ${Date.now() - startTime}`);

            return platformCollection;
        } else {
            console.log(`Platform file not found: ${platformFile}`);
        }
    } catch (error) {
        console.error(`Failed to load Platform "${platform}": ${error}`);
    }

    return { games: [], addApps: [] } as IGameCollection;
}

// Of course there is a problem with casing in some platform files.
// We need to list all of the files directory and search for the hits
// manually.
const findPlatformFileCaseInsensitive = async (
    filename: string,
    path: string
): Promise<string> => {
    console.debug(`Checking existence of platform ${filename} xml file..`);

    const lowerCasedFilename = filename.toLowerCase();
    const directoryContent = await fsasync.readdir(path);
    const platformXmlFile = directoryContent.find(
        (f) => f.toLowerCase() === lowerCasedFilename
    );
    if (!platformXmlFile)
        throw new Error(
            `Platform file ${filename} doesn't exist in ${path} directory.`
        );
    return platformXmlFile;
};

export type ErrorCopy = {
    columnNumber?: number;
    fileName?: string;
    lineNumber?: number;
    message: string;
    name: string;
    stack?: string;
};

export type LoadPlatformError = ErrorCopy & {
    /** File path of the platform file the error is related to. */
    filePath: string;
};
