import { fixSlashes } from '@shared/Util';
import { GameImagesCollection, GameVideosCollection, IGameInfo } from '@shared/game/interfaces';
import { IFileInfo } from '@shared/platform/interfaces';
import * as chokidar from "chokidar";
import * as fs from 'fs';
import * as path from 'path';
import { getLaunchboxFilename } from './LaunchBoxHelper';
import store from '@renderer/redux/store';
import { setGameInstalled } from '@renderer/redux/gamesSlice';

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
export async function findGameImageCollection(platImagesPath: string): Promise<GameImagesCollection> {
    const rootFolders = await fs.promises.readdir(platImagesPath, { withFileTypes: true });
    const collection: GameImagesCollection = {};

    for (const dir of rootFolders.filter(f => f.isDirectory())) {
        collection[dir.name] = {}; // Initialize the image category
        const folderPath = path.join(platImagesPath, dir.name);

        for (const s of walkSync(folderPath)) {
            const lastIdx = s.filename.lastIndexOf("-0");
            if (lastIdx > -1) {
                const title = s.filename.slice(0, lastIdx);
                if (!collection[dir.name][title]) {
                    collection[dir.name][title] = [path.relative(platImagesPath, s.path)];
                } else {
                    collection[dir.name][title].push(path.relative(platImagesPath, s.path));
                }
            }
        }
    }

    return collection;
}

export function findGameVideos(videoPath: string): GameVideosCollection {
    const videos: GameVideosCollection = {};

    const files = fs.readdirSync(videoPath).filter(f => f.endsWith('.mp4'));
    for (const s of files) {
        videos[s.split('.mp4')[0]] = s;
    }

    return videos;
}


const thumbnailPreference = [
    'Box - Front',
    'Box - Front - Reconstructed',
    'Fanart - Box - Front',
    'Clear Logo',
    'Screenshot - Game Title',
];

export function loadGameMedia(game: IGameInfo, images: GameImagesCollection, videos: GameVideosCollection) {
    const formattedGameTitle = getLaunchboxFilename(game.title);

    // Load all images
    for (const category of Object.keys(images)) {
        if (images[category][formattedGameTitle]) {
            game.media.images[category] = images[category][formattedGameTitle];
        }
    }

    // Load videos
    try {
        const formattedGamePath = path.basename(fixSlashes(game.applicationPath)).split('.bat')[0];

        if (videos[formattedGamePath]) {
            game.media.video = `Videos/${game.platform}/${videos[formattedGamePath]}`;
        }
    } catch {
        // Ignore, files don't exist if path isn't forming
    }

    // Load thumbnail path
    for (const preference of thumbnailPreference) {
        if (images[preference] && images[preference][formattedGameTitle]) {
            game.thumbnailPath = `Images/${game.platform}/${fixSlashes(images[preference][formattedGameTitle][0])}`;
            return;
        }
    }
}


export function initExodosInstalledGamesWatcher(
    folder: string,
): chokidar.FSWatcher {
    console.log(
        `Initializing installed games watcher with ${folder} path...`
    );
    
    const installedGamesWatcher = chokidar.watch(folder, {
        depth: 0,
        persistent: true,
    });

    installedGamesWatcher
        .on("ready", () => {
            console.log("Installed games watcher is ready.");
            installedGamesWatcher
                .on("addDir", (gameDataPath) => {
                    console.log(`Game ${gameDataPath} added, rescan installed games.`);
                    store.dispatch(setGameInstalled({
                        gameDataPath,
                        value: true,
                    }));
                })
                .on("unlinkDir", (gameDataPath) => {
                    console.log(`Game ${gameDataPath} has been removed, rescan installed games.`);
                    store.dispatch(setGameInstalled({
                        gameDataPath,
                        value: false,
                    }));
                });
            console.log("Initial scan complete. Ready for changes");
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));

    return installedGamesWatcher;
}