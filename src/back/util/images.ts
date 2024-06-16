import { GameImagesCollection, GameVideosCollection, IGameInfo } from '@shared/game/interfaces';
import * as fs from 'fs';
import * as path from 'path';
import { walkSync } from './misc';

// Finds a list of all game images, returned in a map where the key is the type of image, and the value is an array of filenames
export async function findGameImageCollection(platImagesPath: string): Promise<GameImagesCollection> {
    const rootFolders = await fs.promises.readdir(platImagesPath, { withFileTypes: true });
    const collection: GameImagesCollection = {};

    if (fs.existsSync(platImagesPath)) {
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
    }

    return collection;
}

export function findGameVideos(videoPath: string): GameVideosCollection {
    const videos: GameVideosCollection = {};

    if (fs.existsSync(videoPath)) {
        const files = fs.readdirSync(videoPath).filter(f => f.endsWith('.mp4'));
        for (const s of files) {
            videos[s.split('.mp4')[0]] = s;
        }
    }

    return videos;
}
