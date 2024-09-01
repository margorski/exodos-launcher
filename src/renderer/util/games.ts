import * as chokidar from "chokidar";
import * as path from "path";
import store from "@renderer/redux/store";
import { updateGame } from "@renderer/redux/gamesSlice";
import { IGameCollection } from "@shared/game/interfaces";
import { fixSlashes, removeLowestDirectory } from "@shared/Util";

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

export function getGameByTitle(title: string) {
    const state = store.getState().gamesState;
    const game = state.games.find((g) => {
        const gameTitle = path
            .basename(fixSlashes(g.applicationPath))
            .split(".")[0];
        return gameTitle === title;
    });
    return game;
}

export function getGameByDirectory(gamePath: string) {
    const state = store.getState().gamesState;
    const dirname = path.basename(gamePath);

    // Find matching game, if exists
    return state.games.find((game) => {
        return fixSlashes(game.rootFolder).endsWith(`/${dirname}`);
    });
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
            console.debug(`Game ${gameDataPath} added.`);
            const game = getGameByDirectory(gameDataPath);
            if (game) {
                store.dispatch(
                    updateGame({
                        game: {
                            ...game,
                            installed: true,
                        },
                    })
                );
            }
        })
        .on("unlinkDir", (gameDataPath) => {
            console.debug(`Game ${gameDataPath} has been removed.`);
            const game = getGameByDirectory(gameDataPath);
            if (game) {
                store.dispatch(
                    updateGame({
                        game: {
                            ...game,
                            installed: false,
                        },
                    })
                );
            }
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}
