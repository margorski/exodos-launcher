# exogui

The launcher for eXoDOS project.

### Status

### Links

-   [eXoDOS](https://exodos.the-eye.us) - eXoDOS project

## About

The exogui is a desktop application made for browsing, storing and launching other applications (games, manuals etc.). It is specifically made for eXoDOS v5 project. Application is based on Flashpoint Launcher application. [BlueMaxima's Flashpoint](https://bluemaxima.org/flashpoint/) is generally very cool project so do not forget to check their website. Exogui loads Launchbox configuration files format.

If you need guidance on setting up eXoDOS on Linux, you can refer to the [linux guide page](https://www.retro-exo.com/linux.html) on the Retro-Exo website. If you encounter any issues, feel free to seek help on the #linux_port_for_nerds channel on the [eXoDOS Discord](https://discord.com/invite/37FYaUZ) server.

## Setup

How to setup a development environment:

1. Download the project (and extract it, if it was downloaded as an archive)
2. Open a command prompt and navigate it to the projects root folder
3. Run `npm install`

## Development

Recommended setup for development:

1. Clone the repository with `git clone --recurse-submodules https://github.com/margorski/exodos-launcher launcher`
2. In the new 'launcher' folder run `npm run watch` and let the prompt stay open
3. Open a second command prompt and run `npm run start`

## Package Scripts

-   `build` - Build the launcher (build main & renderer and copy static files to `./build/`)
-   `watch` - Build the launcher and incrementally rebuild it when the source or static files change
-   `pack` - Pack the latest build (and put the packaged file with the executable electron app in `./dist/`)
-   `release` - Build then pack the launcher (same as running `build` then `pack`)
-   `start` - Run the latest build of the launcher

`pack` and `release` will by default pack for the OS and architecture of the machine that runs it.

To pack for a specific OS / architecture use the handy package scripts (such as `pack:linux` or `release:win32`) or set the environment variables `PACK_PLATFORM` / `PACK_ARCH`.

## Troubleshooting

### "Not allowed to load local resource" Error

If this error appears in the electron applications console, it is probably because the file it is looking for does not exist. To solve this, run `npm run build`

Example: `Not allowed to load local resource: file:///<ProjectPath>/build/renderer/index.html`
