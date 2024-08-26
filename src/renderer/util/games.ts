import * as chokidar from "chokidar";
import * as path from "path";
import store from "@renderer/redux/store";
import { setGameInstalled } from "@renderer/redux/gamesSlice";
import { IGameCollection } from "@shared/game/interfaces";
import { removeLowestDirectory } from "@shared/Util";

export function createGamesWatcher(platformCollection: IGameCollection) {
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
        createWatcher(gamesAbsolutePath);
    }
}

function createWatcher(folder: string): chokidar.FSWatcher {
    console.log(`Initializing installed games watcher with ${folder} path...`);

    const watcher = chokidar.watch(folder, {
        depth: 0,
        persistent: true,
        followSymlinks: false,
        ignored: /DOWNLOAD$/,
        ignoreInitial: true,
    });

    watcher
        .on("addDir", (gameDataPath) => {
            console.log(`Game ${gameDataPath} added.`);

            store.dispatch(
                setGameInstalled({
                    gameDataPath,
                    value: true,
                })
            );
        })
        .on("unlinkDir", (gameDataPath) => {
            console.log(`Game ${gameDataPath} has been removed.`);
            store.dispatch(
                setGameInstalled({
                    gameDataPath,
                    value: false,
                })
            );
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}
