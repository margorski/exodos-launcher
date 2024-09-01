import * as chokidar from "chokidar";
import store from "@renderer/redux/store";
import {
    addAddAppsForGame as addAddApp,
    updateGame,
} from "@renderer/redux/gamesSlice";
import { deepCopy, fixSlashes } from "@shared/Util";
import {
    IAdditionalApplicationInfo,
    IGameCollection,
    IGameInfo,
} from "@shared/game/interfaces";
import * as fs from "fs";
import * as path from "path";
import { getGameByDirectory, getGameByTitle } from "./games";

// @TODO Move it to seperate module to make it easier to extend (it would be best to have it in json)
const ADD_APPS_DIRECTORIES = ["Extras", "Magazines"];
const ALLOWED_EXTENSIONS = [
    "pdf",
    "jpg",
    "xlsx",
    "doc",
    "txt",
    "html",
    "command",
    "mp4",
];

export function loadDynamicAddAppsForGame(
    game: IGameInfo
): IAdditionalApplicationInfo[] {
    const { rootFolder } = game;
    if (!rootFolder) {
        console.debug("Game root folder path empty.");
        return [];
    }

    return ADD_APPS_DIRECTORIES.reduce<IAdditionalApplicationInfo[]>(
        (addApps, addAppsDir) => {
            const addAppsForDir = loadAddAppsDirectory(game, addAppsDir);
            return addApps.concat(addAppsForDir);
        },
        []
    );
}

function loadAddAppsDirectory(game: IGameInfo, addAppsDir: string) {
    try {
        const addApps: IAdditionalApplicationInfo[] = [];
        const { rootFolder } = game;

        const relativePathForAddApps = path.join(
            fixSlashes(rootFolder),
            addAppsDir
        );
        const absolutePathForAddApps = path.join(
            window.External.config.fullExodosPath,
            relativePathForAddApps
        );
        console.debug(
            `Searching for extras in the ${absolutePathForAddApps} for game ${game.title}`
        );

        if (
            !fs.existsSync(absolutePathForAddApps) ||
            !fs.statSync(absolutePathForAddApps).isDirectory()
        ) {
            return [];
        }

        const dir = fs.readdirSync(absolutePathForAddApps);
        const files = dir.filter((f) =>
            fs.statSync(path.join(absolutePathForAddApps, f)).isFile()
        );

        for (const file of files.filter((f) =>
            ALLOWED_EXTENSIONS.includes(f.split(".")?.[1] ?? "")
        )) {
            const filepath = path.join(relativePathForAddApps, file);
            const addApp = createAddApp(game, filepath);
            console.debug(`Found ${addApp.applicationPath} extras`);
            addApps.push(addApp);
        }
        return addApps;
    } catch (e) {
        console.error(
            `Error while reading extras directory for game: ${game.title} Error: ${e}`
        );
        return [];
    }
}

function getExtrasId(gameId: string, filename: string): string {
    return `${gameId}-${filename}`;
}

function createAddApp(
    game: IGameInfo,
    filepath: string
): IAdditionalApplicationInfo {
    const relativePath = filepath.replace(
        window.External.config.fullExodosPath,
        ""
    );
    const filename = filepath.split("/").pop() ?? "Unknown";
    const name = filename.split(".")[0];
    const id = getExtrasId(game.id, filepath);
    return {
        id,
        applicationPath: relativePath,
        autoRunBefore: false,
        gameId: game.id,
        launchCommand: ``,
        name,
        waitForExit: false,
    };
}

export function createAddAppsWatcher(
    platformCollection: IGameCollection
): chokidar.FSWatcher | undefined {
    const addAppsPaths = getPlatformAddAppsPaths(platformCollection);
    if (!addAppsPaths) {
        console.log(
            "AddApps watcher: no games on list, watcher do not initialized."
        );
        return;
    }

    console.log(`Initializing addApps watcher for paths ${addAppsPaths}`);

    const watcher = chokidar.watch(addAppsPaths, {
        persistent: true,
        followSymlinks: false,
        ignoreInitial: true,
    });

    watcher
        .on("add", (path) => {
            const extension = path.split(".").pop()?.toLocaleLowerCase();
            if (extension && ALLOWED_EXTENSIONS.includes(extension)) {
                const pathElements = path.split("/");

                // the third element from the end is the directory which is game identifier
                const gameDir = pathElements[pathElements.length - 3];
                const game = getGameByDirectory(gameDir);
                if (game) {
                    console.debug(
                        "Found the game for the addApp. Refreshing game addApps."
                    );
                    const addApp = createAddApp(game, path);
                    store.dispatch(
                        addAddApp({
                            addApp,
                        })
                    );
                }
                console.debug(
                    `AddApps ${path} added. Refreshing addApps for the game`
                );
            } else {
                console.debug(
                    `AddApps watcher: do not allowed extension ${path}`
                );
            }
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}

function getPlatformAddAppsPaths(platformCollection: IGameCollection) {
    if (platformCollection.games.length === 0) return;

    const platformRoot = fixSlashes(platformCollection.games[0].rootFolder)
        .split("/")
        .slice(0, -1)
        .join("/");
    const basePath = path.join(
        window.External.config.fullExodosPath,
        platformRoot
    );
    return ADD_APPS_DIRECTORIES.map((d) => `${basePath}/${d}/*`);
}

export function createManualsWatcher(platform: string): chokidar.FSWatcher {
    const path = getPlatformManualsPath(platform);
    console.log(`Initializing manuals watcher for ${platform} path ${path}`);

    const watcher = chokidar.watch(path, {
        depth: 0,
        persistent: true,
        followSymlinks: false,
        ignoreInitial: true,
    });

    watcher
        .on("add", (path) => {
            console.debug(`Manual ${path} added.`);
            const relativePath = path.replace(
                window.External.config.fullExodosPath,
                ""
            );
            const title = relativePath.split("/").pop()?.split(".")[0];
            if (title) {
                const game = getGameByTitle(title);
                if (game) {
                    console.debug(
                        `Found the game for the new manual. Updating game ${title}`
                    );
                    const updatedGame = deepCopy(game);
                    updatedGame.manualPath = relativePath;
                    store.dispatch(
                        updateGame({
                            game: updatedGame,
                        })
                    );
                }
            }
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}

function getPlatformManualsPath(platform: string) {
    return path.join(
        window.External.config.fullExodosPath,
        "Manuals",
        platform
    );
}
