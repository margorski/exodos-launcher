import { LogFunc } from "@back/types";
import * as http from "http";

export interface IFileServerOpts {
    server: http.Server;
    minPort: number;
    maxPort: number;
    log: LogFunc;
}

export function startFileServer(opts: IFileServerOpts): Promise<number> {
    const { minPort, maxPort, server, log } = opts;

    return new Promise<number>((resolve) => {
        let port = minPort - 1;
        server.once("listening", onceListening);
        server.on("error", onError);
        tryListen();

        function onceListening() {
            done(undefined);
        }

        function onError(error: Error) {
            if ((error as any).code === "EADDRINUSE") {
                tryListen();
            } else {
                done(error);
            }
        }
        function tryListen() {
            if (port++ < maxPort) {
                server.listen(port, "localhost");
            } else {
                done(
                    new Error(
                        `All attempted ports are already in use (Ports: ${minPort} - ${maxPort}).`
                    )
                );
            }
        }

        function done(error: Error | undefined) {
            server.off("listening", onceListening);
            server.off("error", onError);
            if (error) {
                log({
                    source: "Back",
                    content: "Failed to open HTTP server.\n" + error,
                });
                resolve(-1);
            } else {
                resolve(port);
            }
        }
    });
}
