import { isAnyOf } from "@reduxjs/toolkit";
import { readPlatformsFile } from "@renderer/file/PlatformFile";
import { formatPlatformFileData } from "@renderer/util/LaunchBoxHelper";
import {
    findGameImageCollection as findPlatformImages,
    findVideo as findPlatformVideos,
    initExodosInstalledGamesWatcher,
    loadDynamicExtrasForGame,
    mapGamesMedia,
} from "@renderer/util/gamesHelper";
import { removeLowestDirectory } from "@shared/Util";
import { GameParser } from "@shared/game/GameParser";
import * as fastXmlParser from "fast-xml-parser";
import * as fs from "fs";
import * as path from "path";
import {
    GamesInitState,
    initialize,
    setGames,
    setLibraries,
} from "./gamesSlice";
import { startAppListening } from "./listenerMiddleware";
import { initializeViews } from "./searchSlice";
import { IGameCollection, IGameInfo } from "@shared/game/interfaces";
import { GameCollection } from "@shared/game/GameCollection";

// @TODO - watchable platforms should be defined in seperate file to be easily adjustable, ideally in the json cfg file
const watchablePlatforms = ["MS-DOS"];

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
                const platformCollection = await loadPlatform(
                    platform,
                    platformsPath
                );
                if (platformCollection.games.length > 0) {
                    libraries.push(platform);
                }
                collection.push(platformCollection);
                if (watchablePlatforms.includes(platform))
                    createGamesWatcher(platformCollection);
            }
            console.debug(`Load time - ${Date.now() - startTime}ms`);

            libraries.sort();
            listenerApi.dispatch(setLibraries(libraries));
            listenerApi.dispatch(initializeViews(libraries));
            listenerApi.dispatch(setGames(collection));
        },
    });
}

async function loadPlatform(platform: string, platformsPath: string) {
    console.log(`Loading platform ${platform} from ${platformsPath}`);

    try {
        const platformFile = path.join(platformsPath, `${platform}.xml`);
        console.debug(
            `Checking existence of platform ${platformFile} xml file..`
        );

        if ((await fs.promises.stat(platformFile)).isFile()) {
            console.debug(`Platform file found: ${platformFile}`);

            const content = await fs.promises.readFile(platformFile, {
                encoding: "utf-8",
            });

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

            if (!formatPlatformFileData(data)) {
                throw new Error(`Failed to parse XML file: ${platformFile}`);
            }

            const images = await loadPlatformImages(platform);
            const videos = await loadPlatformVideos(platform);
            const platformCollection = GameParser.parse(
                data,
                platform,
                window.External.config.fullExodosPath
            );

            for (const game of platformCollection.games) {
                mapGamesMedia(game, images, videos);

                const dynamicExtras = loadDynamicExtrasForGame(game);
                if (dynamicExtras.length > 0)
                    console.debug(
                        `Found ${dynamicExtras.length} for ${game.title} game.`
                    );
                platformCollection.addApps.push(...dynamicExtras);
            }

            return platformCollection;
        } else {
            console.log(`Platform file not found: ${platformFile}`);
        }
    } catch (error) {
        console.error(`Failed to load Platform "${platform}": ${error}`);
    }

    return { games: [], addApps: [] } as IGameCollection;
}

async function loadPlatformImages(platform: string) {
    const imagesRoot = path.join(
        window.External.config.fullExodosPath,
        window.External.config.data.imageFolderPath,
        platform
    );
    return await findPlatformImages(imagesRoot);
}

async function loadPlatformVideos(platform: string) {
    const videosRoot = path.join(
        window.External.config.fullExodosPath,
        "Videos",
        platform
    );
    return findPlatformVideos(videosRoot);
}

function createGamesWatcher(platformCollection: IGameCollection) {
    const firstValidGame = platformCollection.games.find((g) => !!g.rootFolder);
    const gamesRelativePath = removeLowestDirectory(
        firstValidGame?.rootFolder ?? "",
        2
    );

    if (!!gamesRelativePath) {
        const gamesAbsolutePath = path.join(
            window.External.config.fullExodosPath,
            gamesRelativePath
        );
        initExodosInstalledGamesWatcher(gamesAbsolutePath);
    }
}

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
