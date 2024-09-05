const fs = require("fs-extra");
const gulp = require("gulp");
const builder = require("electron-builder");
const { Platform, archFromString } = require("electron-builder");
const { exec } = require("child_process");

const packageJson = JSON.parse(fs.readFileSync("./package.json"));
const config = {
    buildVersion: Date.now().toString(),
    isRelease: process.env.NODE_ENV === "production",
    isStaticInstall: packageJson.config.installed,
    static: {
        src: "./static",
        dest: "./build",
    },
    main: {
        src: "./src/main",
    },
    sevenZip: "./extern/7zip-bin",
    back: {
        src: "./src/back",
    },
};

/* ------ Watch ------ */

gulp.task("watch-back", (done) => {
    execute("npx tspc --project tsconfig.backend.json --pretty --watch", done);
});

gulp.task("watch-renderer", (done) => {
    const mode = config.isRelease ? "production" : "development";
    execute(`npx webpack --mode "${mode}" --watch`, done);
});

gulp.task("watch-static", () => {
    gulp.watch(config.static.src + "/**/*", gulp.task("copy-static"));
});

/* ------ Build ------ */

gulp.task("build-back", (done) => {
    execute("npx tspc --project tsconfig.backend.json --pretty", done);
});

gulp.task("build-renderer", (done) => {
    const mode = config.isRelease ? "production" : "development";
    execute(`npx webpack --mode "${mode}"`, done);
});

gulp.task("copy-static", () => {
    return gulp
        .src(config.static.src + "/**/*")
        .pipe(gulp.dest(config.static.dest));
});

gulp.task("config-install", (done) => {
    if (config.isStaticInstall) {
        fs.createFile(".installed", done);
    } else {
        fs.remove(".installed", done);
    }
});

gulp.task("config-version", (done) => {
    fs.writeFile(".version", config.buildVersion, done);
});

/* ------ Pack ------ */

gulp.task("pack", (done) => {
    const targets = createBuildTargets(
        process.env.PACK_PLATFORM,
        process.env.PACK_ARCH,
    );
    const publish = process.env.PUBLISH ? createPublishInfo() : []; // Uses Git repo for unpublished builds
    const copyFiles = getCopyFiles();
    builder
        .build({
            config: {
                appId: "com.exo.exogui",
                productName: "exogui",
                directories: {
                    buildResources: "./static/",
                    output: "./dist/",
                },
                files: ["./build"],
                extraFiles: copyFiles, // Files to copy to the build folder
                compression: "store", // Only used if a compressed target (like 7z, nsis, dmg etc)
                target: "dir", // Keep unpacked versions of every pack
                asar: true,
                publish: publish,
                linux: {
                    publish: "github",
                },
                win: {
                    icon: "./icons/icon.ico",
                },
                mac: {
                    icon: "./icons/icon.icns",
                },
            },
            targets: targets,
        })
        .then(() => {
            console.log("Pack - Done!");
        })
        .catch((error) => {
            console.log("Pack - Error!", error);
        })
        .then(done);
});

/* ------ Meta Tasks ------*/

gulp.task(
    "watch",
    gulp.parallel(
        "watch-back",
        "watch-renderer",
        "watch-static",
        "copy-static",
    ),
);

gulp.task(
    "build",
    gulp.parallel(
        "build-back",
        "build-renderer",
        "copy-static",
        "config-install",
        "config-version",
    ),
);

/* ------ Misc ------*/

function execute(command, callback) {
    const child = exec(command);
    child.stderr.on("data", (data) => {
        console.log(data);
    });
    child.stdout.on("data", (data) => {
        console.log(data);
    });
    if (callback) {
        child.once("exit", () => {
            callback();
        });
    }
}

function createBuildTargets(os, arch) {
    switch (os) {
        case "win32":
            return Platform.WINDOWS.createTarget("nsis", archFromString(arch));
        case "darwin":
            return Platform.MAC.createTarget("dmg", archFromString(arch));
        case "linux":
            return Platform.LINUX.createTarget(
                ["tar.gz", "dir"],
                archFromString(arch),
            );
    }
}

function getCopyFiles() {
    return [
        {
            // Only copy 7zip execs for packed platform
            from: "./extern/7zip-bin",
            to: "./extern/7zip-bin",
            filter: ["${os}/**/*"],
        },
        "./lang",
        "./licenses",
        "./.installed",
        "./mappings.json",
        {
            from: "./LICENSE",
            to: "./licenses/LICENSE",
        },
    ];
}

function createPublishInfo() {
    return [
        {
            provider: "github",
            owner: "margorski",
            repo: "exodos-launcher",
        },
    ];
}
