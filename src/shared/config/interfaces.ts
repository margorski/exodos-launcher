/** Data contained in the Config file */
export type IAppConfigData = {
    /** Path to the Exodos root folder (relative or absolute) */
    exodosPath: string;
    /** Path to the image folder (relative to the exodos path) */
    imageFolderPath: string;
    /** Path to the logo folder (relative to the exodos path) */
    logoFolderPath: string;
    /** Path to the playlist folder (relative to the exodos path) */
    playlistFolderPath: string;
    /** Path to the json folder (relative to the exodos path) */
    jsonFolderPath: string;
    /** Path to the platform folder (relative to the exodos path) */
    platformFolderPath: string;
    /** Path to the theme folder (relative to the exodos path) */
    themeFolderPath: string;
    /** If the custom title bar should be used in MainWindow */
    useCustomTitlebar: boolean;
    /** Array of native locked platforms */
    nativePlatforms: string[];
    /** Lower limit of the range of ports that the back should listen on. */
    backPortMin: number;
    /** Upper limit of the range of ports that the back should listen on. */
    backPortMax: number;
    /** Lower limit of the range of ports that the back image server should listen on. */
    imagesPortMin: number;
    /** Upper limit of the range of ports that the back image server should listen on. */
    imagesPortMax: number;
};
