import { fixSlashes } from "@shared/Util";
import {
    GameImagesCollection,
    GameVideosCollection,
    IAdditionalApplicationInfo,
    IGameInfo,
} from "@shared/game/interfaces";
import { IFileInfo } from "@shared/platform/interfaces";
import * as chokidar from "chokidar";
import * as fs from "fs";
import * as path from "path";
import { getLaunchboxFilename } from "./LaunchBoxHelper";
import store from "@renderer/redux/store";
import { addExtras, setGameInstalled } from "@renderer/redux/gamesSlice";

const EXTRAS_DIR = "Extras";

export function* walkSync(dir: string): IterableIterator<IFileInfo> {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name));
        } else {
            yield {
                filename: file.name,
                path: path.join(dir, file.name),
            };
        }
    }
}

// Finds a list of all game images, returned in a map where the key is the type of image, and the value is an array of filenames
export async function findGameImageCollection(
    platImagesPath: string
): Promise<GameImagesCollection> {
    const rootFolders = await fs.promises.readdir(platImagesPath, {
        withFileTypes: true,
    });
    const collection: GameImagesCollection = {};

    if (fs.existsSync(platImagesPath)) {
        for (const dir of rootFolders.filter((f) => f.isDirectory())) {
            collection[dir.name] = {}; // Initialize the image category
            const folderPath = path.join(platImagesPath, dir.name);

            for (const s of walkSync(folderPath)) {
                const lastIdx = s.filename.lastIndexOf("-0");
                if (lastIdx > -1) {
                    const title = s.filename.slice(0, lastIdx);
                    if (!collection[dir.name][title]) {
                        collection[dir.name][title] = [
                            path.relative(platImagesPath, s.path),
                        ];
                    } else {
                        collection[dir.name][title].push(
                            path.relative(platImagesPath, s.path)
                        );
                    }
                }
            }
        }
    }

    return collection;
}

export function findVideo(videoPath: string): GameVideosCollection {
    const videos: GameVideosCollection = {};

    if (fs.existsSync(videoPath)) {
        const files = fs
            .readdirSync(videoPath)
            .filter((f) => f.endsWith(".mp4"));
        for (const s of files) {
            videos[s.split(".mp4")[0]] = s;
        }
    }

    return videos;
}

const thumbnailPreference = [
    "Box - Front",
    "Box - Front - Reconstructed",
    "Fanart - Box - Front",
    "Clear Logo",
    "Screenshot - Game Title",
];

/// Search for the medias for the game in the images and videos collection and fill this info to the game metadata object
export function mapGamesMedia(
    game: IGameInfo,
    images: GameImagesCollection,
    videos: GameVideosCollection
) {
    const formattedGameTitle = getLaunchboxFilename(game.title);

    // Load all images
    for (const category of Object.keys(images)) {
        if (images[category][formattedGameTitle]) {
            game.media.images[category] = images[category][formattedGameTitle];
        }
    }

    // Load videos
    try {
        const formattedGamePath = path
            .basename(fixSlashes(game.applicationPath))
            .split(".bat")[0];

        if (videos[formattedGamePath]) {
            game.media.video = `Videos/${game.platform}/${videos[formattedGamePath]}`;
        }
    } catch {
        // Ignore, files don't exist if path isn't forming
    }

    // Load thumbnail path
    for (const preference of thumbnailPreference) {
        if (images[preference] && images[preference][formattedGameTitle]) {
            game.thumbnailPath = `Images/${game.platform}/${fixSlashes(
                images[preference][formattedGameTitle][0]
            )}`;
            return;
        }
    }
}

export function initExodosInstalledGamesWatcher(
    folder: string
): chokidar.FSWatcher {
    console.log(`Initializing installed games watcher with ${folder} path...`);

    const installedGamesWatcher = chokidar.watch(folder, {
        depth: 0,
        persistent: true,
        ignored: /DOWNLOAD$/,
    });

    installedGamesWatcher
        .on("ready", () => {
            console.log("Installed games watcher is ready.");
            installedGamesWatcher
                .on("addDir", (gameDataPath) => {
                    console.log(`Game ${gameDataPath} added.`);
                    const addApps = loadDynamicExtrasForGame(gameDataPath);

                    store.dispatch(
                        addExtras({
                            addApps,
                        }),
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
                });
            console.log("Initial scan complete. Ready for changes");
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return installedGamesWatcher;
}

export function loadDynamicExtrasForGame(
    gamePath: string
): IAdditionalApplicationInfo[] {
    if (!gamePath) throw new Error("Game root folder path empty.");
    const gameId = gamePath.split("\\").pop();

    if (!gameId) {
        console.debug(
            "GameId infered from game path is invalid. Check if game path is correct."
        );
        return [];
    }

    const relativeExtras = path.join(fixSlashes(gamePath), EXTRAS_DIR);
    const gameExtrasPath = path.join(
        window.External.config.fullExodosPath,
        relativeExtras
    );

    const addApps: IAdditionalApplicationInfo[] = [];

    console.debug(
        `Searching for extras in the ${gameExtrasPath} for game Id ${gameId}`
    );
    try {
        if (
            !fs.existsSync(gameExtrasPath) ||
            !fs.statSync(gameExtrasPath).isDirectory()
        ) {
            return [];
        }

        const dir = fs.readdirSync(gameExtrasPath);
        const files = dir.filter((f) =>
            fs.statSync(path.join(gameExtrasPath, f)).isFile()
        );

        const ignoredExtensions = ["bat", "bsh", "msh", ""];
        for (const file of files.filter(
            (f) => !ignoredExtensions.includes(f.split(".")?.[1] ?? "")
        )) {
            const name = file.split(".")[0];
            const id = getExtrasId(gameId, file);
            const addApp = {
                applicationPath: path.join(relativeExtras, file),
                autoRunBefore: false,
                gameId: gameId,
                id,
                launchCommand: ``,
                name,
                waitForExit: false,
            };
            console.debug(`Found ${addApp.applicationPath} extras`);
            addApps.push(addApp);
        }
    } catch (e) {
        console.error(
            `Error while reading extras directory: ${gameExtrasPath} Error: ${e}`
        );
        return [];
    }

    return addApps;
}

function getExtrasId(gameId: string, filename: string): string {
    return `${gameId}-${filename}`;
}
