export interface IPlatformConfig {
    // field is used to map platform with config
    name: string;
    // gamesPlaylists indicate main platform for game and it force backend
    // to include into playlists installed games playlist and add all other
    // playlists.
    gamesPlatform: boolean;
}

// configs are m
export const platformConfigs: IPlatformConfig[] = [
    {
        name: "MS-DOS",
        gamesPlatform: true,
    },
];
