import { fixSlashes } from "@shared/Util";
import {
    GameImagesCollection,
    GameVideosCollection,
    IGameInfo,
} from "@shared/game/interfaces";
import * as fs from "fs";
import * as path from "path";
import { getLaunchboxFilename } from "./LaunchBoxHelper";
import { IFileInfo } from "@shared/platform/interfaces";

export function findVideosInPath(videoPath: string): GameVideosCollection {
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

// Finds a list of all game images, returned in a map where the key is the type of image, and the value is an array of filenames
export async function findGameImageCollection(
    platformImagesPath: string
): Promise<GameImagesCollection> {
    const rootFolders = await fs.promises.readdir(platformImagesPath, {
        withFileTypes: true,
    });
    const collection: GameImagesCollection = {};

    if (fs.existsSync(platformImagesPath)) {
        for (const dir of rootFolders.filter((f) => f.isDirectory())) {
            collection[dir.name] = {}; // Initialize the image category
            const folderPath = path.join(platformImagesPath, dir.name);

            for (const s of walkSync(folderPath)) {
                const lastIdx = s.filename.lastIndexOf("-0");
                if (lastIdx > -1) {
                    const title = s.filename.slice(0, lastIdx);
                    if (!collection[dir.name][title]) {
                        collection[dir.name][title] = [
                            path.relative(platformImagesPath, s.path),
                        ];
                    } else {
                        collection[dir.name][title].push(
                            path.relative(platformImagesPath, s.path)
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
