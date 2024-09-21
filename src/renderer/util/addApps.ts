import * as chokidar from "chokidar";
import store from "@renderer/redux/store";
import { updateGame } from "@renderer/redux/gamesSlice";
import { deepCopy, fixSlashes } from "@shared/Util";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import * as fs from "fs";
import * as path from "path";
import { getGameByTitle } from "./games";
import { getAllowedExtensionsForMappings } from "@shared/mappings/CommandMapping";
import { throttle } from "@shared/utils/throttle";
import { BackIn, LaunchGameData } from "@shared/back/types";

// @TODO Move it to seperate module to make it easier to extend (it would be best to have it in json)
const ADD_APPS_DIRECTORIES = ["Extras", "Magazines"];

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
        const allowedExtensions = getAllowedExtensionsForMappings(
            window.External.commandMappings
        );
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

        const files = fs.readdirSync(absolutePathForAddApps, {
            withFileTypes: true,
        });

        for (const file of files.filter((f) => {
            const extension = f.name.split(".")?.[1]?.toLowerCase() ?? "";
            return extension && f.isFile() && allowedExtensions.has(extension);
        })) {
            const filepath = path.join(relativePathForAddApps, file.name);
            const addApp = createAddApp(game, filepath);
            addApps.push(addApp);
        }
        return addApps;
    } catch (e: any) {
        if (e.code !== "ENOENT") {
            console.error(
                `Error while reading extras directory for game: ${game.title} Error: ${e}`
            );
        }
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
