import * as chokidar from "chokidar";
import store from "@renderer/redux/store";
import { updateGame } from "@renderer/redux/gamesSlice";
import { fixSlashes } from "@shared/Util";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import * as fs from "fs";
import * as path from "path";

export function loadDynamicAddAppsForGame(
    game: IGameInfo
): IAdditionalApplicationInfo[] {
    const { rootFolder } = game;
    if (!rootFolder) {
        console.debug("Game root folder path empty.");
        return [];
    }

    // @TODO Move it to seperate module to make it easier to extend (it would be best to have it in json)
    const ADD_APPS_DIRECTORIES = ["Extras", "Magazines"];

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
        const { rootFolder, id: gameId } = game;

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

        // @TODO Change blacklist for the whitelist
        const ignoredExtensions = ["bat", "bsh", "msh", ""];
        for (const file of files.filter(
            (f) => !ignoredExtensions.includes(f.split(".")?.[1] ?? "")
        )) {
            const name = file.split(".")[0];
            const id = getExtrasId(gameId, file);
            const addApp = {
                id,
                applicationPath: path.join(relativePathForAddApps, file),
                autoRunBefore: false,
                gameId,
                launchCommand: ``,
                name,
                waitForExit: false,
            };
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

// @TODO add manual directory
export function createAddAppsWatcher(): chokidar.FSWatcher {
    const addAppsPaths = getPlatformAddAppsPaths();
    console.log(`Initializing addApps watcher for paths ${addAppsPaths}`);

    const watcher = chokidar.watch(addAppsPaths, {
        depth: 0,
        persistent: true,
        followSymlinks: false,
        ignoreInitial: true,
    });

    watcher
        .on("add", (path) => {
            console.log(`AddApps ${path} added.`);
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}

function getPlatformAddAppsPaths() {
    const basePath = path.join(
        window.External.config.fullExodosPath,
        "eXo/eXoDOS/!dos/*/"
    );
    return [`${basePath}/Magazines`, `${basePath}/Extras`];
}
