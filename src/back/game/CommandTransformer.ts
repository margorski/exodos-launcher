interface ICommandTransformer {
    extensions: string[];
    transform: (filename: string, args: string) => string;
}

const FLATPAK_RUN = `flatpak run com.retro_exo`;

const mediaTransformer: ICommandTransformer = {
    extensions: ["avi", "flac", "mp3", "mp4", "wav"],
    transform: (filename, _) => `${FLATPAK_RUN}.mpv --force-window ${filename}`,
};

const graphicTransformer: ICommandTransformer = {
    extensions: ["bmp", "gif", "jfif", "jpeg", "jpg", "pdf", "png"],
    transform: (filename, _) => `${FLATPAK_RUN}.okular ${filename}`,
};

const comicsTransformer: ICommandTransformer = {
    extensions: ["cbr"],
    transform: (filename, _) => `${FLATPAK_RUN}.${filename}`,
};

const documentTransformer: ICommandTransformer = {
    extensions: ["doc", "docx", "rtf", "txt"],
    transform: (filename, _) => `${FLATPAK_RUN}.abiword ${filename}`,
};

const exeTransformer: ICommandTransformer = {
    extensions: ["exe"],
    transform: (filename, args) =>
        `${FLATPAK_RUN}.wine-9-0 ${filename} ${args}`,
};

const scriptTransformer: ICommandTransformer = {
    extensions: ["command"],
    transform: (filename, args) => `${filename} ${args}`,
};

const htmlTransformer: ICommandTransformer = {
    extensions: ["htm", "html"],
    transform: (filename, _) => `${FLATPAK_RUN}.falkon -i ${filename}`,
};

const spreadsheetTransformer: ICommandTransformer = {
    extensions: ["xls", "xlsx", "ods"],
    transform: (filename, _) => `${FLATPAK_RUN}.gnumeric ${filename}`,
};

const defaultTransformer: ICommandTransformer = {
    extensions: [],
    transform: (filename, args) => `xdg-open ${filename} ${args}`,
};

export function getCommandTransformer(filename: string) {
    const extension = filename.split(".").pop();
    if (!extension) throw "Invalid file without extension.";

    const transformer = transformers.find((t) =>
        t.extensions.includes(extension.toLocaleLowerCase())
    );
    return transformer ?? defaultTransformer;
}

// add  every new transformer to array
const transformers = [
    mediaTransformer,
    graphicTransformer,
    comicsTransformer,
    documentTransformer,
    exeTransformer,
    scriptTransformer,
    htmlTransformer,
    spreadsheetTransformer,
];

export const ALLOWED_EXTENSIONS = transformers.reduce<string[]>(
    (extensions, command) => {
        extensions.push(...command.extensions);
        return extensions;
    },
    []
);
