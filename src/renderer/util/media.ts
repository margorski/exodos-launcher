import { deepCopy, fixSlashes } from "@shared/Util";
import {
    GameImagesCollection,
    GameVideosCollection,
    IGameInfo,
} from "@shared/game/interfaces";
import * as fs from "fs";
import * as path from "path";
import { getLaunchboxFilename } from "./LaunchBoxHelper";
import { IFileInfo } from "@shared/platform/interfaces";
import * as chokidar from "chokidar";
import { updateGame } from "@renderer/redux/gamesSlice";
import { getGameByTitle } from "./games";
import store from "@renderer/redux/store";

export function loadPlatformVideos(platform: string): GameVideosCollection {
    const videosPath = getPlatformVideosPath(platform);
    const videos: GameVideosCollection = {};

    if (fs.existsSync(videosPath)) {
        const files = fs
            .readdirSync(videosPath)
            .filter((f) => f.endsWith(".mp4"));
        for (const s of files) {
            videos[s.split(".mp4")[0]] = encodeURIComponent(s);
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

// VIDEOS WATCHER
// FOR EVERY dir in the Videos/
//      watch for the .mp4 files
//      do what is in the findVideo
//      call redux action for adding video
//
// comments, probably findVideo doesn't need to be done as initial run of the chokidar runner will iterate over files
// but we want to do at all at once for initial so if there is no way for that then left it and in chokidar do not do
// initial reading
//
// Instead of first load all videos and then in mapGamesMedia map it to game we may search for the video when game is initialized
// and after is installed, but for that we need to ensure that on installation video is extracted first and then game

/// Search for the medias for the game in the images and videos collection and fill this info to the game metadata object
function getGameTitleForVideo(game: IGameInfo) {
    const gameTitle = path
        .basename(fixSlashes(game.applicationPath))
        .split(".")[0];
    return gameTitle;
}

export function mapGamesMedia(
    game: IGameInfo,
    images: GameImagesCollection,
    videos: GameVideosCollection
) {
    // Load videos
    const gameName = getGameTitleForVideo(game);
    try {
        if (videos[gameName]) {
            game.media.video = `Videos/${game.platform}/${videos[gameName]}`;
        }
    } catch {
        // Ignore, files don't exist if path isn't forming
    }

    const formattedGameTitle = getLaunchboxFilename(game.title);

    // Load all images
    for (const category of Object.keys(images)) {
        if (images[category][formattedGameTitle]) {
            game.media.images[category] = images[category][formattedGameTitle];
        }
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

// Finds a list of all game images, returned in a map where the key is the type of image, and the value is an array of filenames
export async function loadPlatformImages(
    platform: string
): Promise<GameImagesCollection> {
    const platformImagesPath = path.join(
        window.External.config.fullExodosPath,
        window.External.config.data.imageFolderPath,
        platform
    );
    const rootFolders = await fs.promises.readdir(platformImagesPath, {
        withFileTypes: true,
    });
    const collection: GameImagesCollection = {};

    if (fs.existsSync(platformImagesPath)) {
        for (const dir of rootFolders.filter((f) => f.isDirectory())) {
            collection[dir.name] = {}; // Initialize the image category
            const folderPath = path.join(platformImagesPath, dir.name);

            for (const s of walkSync(folderPath)) {
                console.log(s.path);
                const lastIdx = s.filename.lastIndexOf("-0");
                if (lastIdx > -1) {
                    const title = s.filename.slice(0, lastIdx);
                    if (!collection[dir.name][title]) {
                        collection[dir.name][title] = [
                            path.relative(
                                platformImagesPath,
                                path.join(
                                    path.dirname(s.path),
                                    encodeURIComponent(s.filename)
                                )
                            ),
                        ];
                    } else {
                        collection[dir.name][title].push(
                            path.relative(
                                platformImagesPath,
                                path.join(
                                    path.dirname(s.path),
                                    encodeURIComponent(s.filename)
                                )
                            )
                        );
                    }
                }
            }
        }
    }

    return collection;
}

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

export function createVideosWatcher(platform: string): chokidar.FSWatcher {
    const videosPath = getPlatformVideosPath(platform);
    console.log(
        `Initializing videos watcher for ${platform} path ${videosPath}`
    );

    const watcher = chokidar.watch(videosPath, {
        depth: 0,
        persistent: true,
        followSymlinks: false,
        ignoreInitial: true,
    });

    watcher
        .on("add", (videoPath) => {
            console.debug(`Video ${videoPath} added.`);
            const relativePath = videoPath.replace(
                window.External.config.fullExodosPath,
                ""
            );
            const title = relativePath.split("/").pop()?.split(".mp4")[0];
            if (title) {
                const game = getGameByTitle(title);
                if (game) {
                    console.debug(
                        `Found the game for the new video. Updating game ${title}`
                    );
                    const updatedGame = deepCopy(game);
                    updatedGame.media.video = relativePath;
                    // HACK: Sometimes extraction of the video is not finished but the view was refreshed and the video doesn't start. Added delay.
                    setTimeout(
                        () =>
                            store.dispatch(
                                updateGame({
                                    game: updatedGame,
                                })
                            ),
                        2000
                    );
                }
            }
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}

function getPlatformVideosPath(platform: string) {
    return path.join(window.External.config.fullExodosPath, "Videos", platform);
}
