import { ChildProcess, spawn } from 'child_process';
import * as net from 'net';
import * as path from 'path';

export class VlcPlayer {
    server: ChildProcess | null = null;
    filepath: string = '';
    private socket: net.Socket | null = null;
    private commandQueue: { command: string; resolve: (value: string) => void; reject: (reason?: any) => void }[] = [];
    private isProcessingQueue: boolean = false;
    private isSocketConnected: boolean = false;
    private firstPlay: boolean = true;

    constructor(
        private vlcPath: string,
        private args: string[],
        private port: number,
        private initialVol: number,
    ) {
        const cwd = path.dirname(this.vlcPath);
        this.server = spawn(this.vlcPath, [
            ...this.args, '-I', 'rc', '--rc-host', `127.0.0.1:${port}`
        ], { cwd, windowsHide: true });
    }

    private async connectSocket(): Promise<void> {
        if (this.socket && this.isSocketConnected) {
            return; // Socket is already connected
        }

        return new Promise((resolve, reject) => {
            this.socket = net.connect(this.port, '127.0.0.1', () => {
                this.isSocketConnected = true;
                resolve();
            });

            this.socket.on('error', (err) => {
                this.isSocketConnected = false;
                reject(err);
            });

            this.socket.on('close', () => {
                this.isSocketConnected = false;
            });
        });
    }

    private async sendCommand(command: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure the socket is connected
                await this.connectSocket();

                // Add the command to the queue
                this.commandQueue.push({ command, resolve, reject });

                // Process the queue if it's not already being processed
                if (!this.isProcessingQueue) {
                    this.processQueue();
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    private processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const { command, resolve, reject } = this.commandQueue.shift()!;

        // Send the command through the socket
        this.socket?.write(command + '\n');

        // Listen for the response
        const onData = (data: Buffer) => {
            resolve(data.toString());
            this.socket?.removeListener('data', onData); // Remove the listener to avoid memory leaks
            this.processQueue(); // Process the next command
        };

        this.socket?.on('data', onData);

        // Handle socket errors
        this.socket?.on('error', (err) => {
            reject(err);
            this.socket?.removeListener('data', onData);
            this.processQueue(); // Process the next command even if there's an error
        });
    }

    private async _play() {
        if (this.filepath) {
            await this.sendCommand('clear');
            await this.sendCommand(`add "${this.filepath}"`);
            if (this.firstPlay) {
                this.firstPlay = false;
                setTimeout(() => {
                    this.setVol(this.initialVol)
                }, 100);
            }
        } else {
            await this.stop();
        }
    }

    async setVol(vol: number): Promise<void> {
        // Convert normalized volume to VLC vol
        this.initialVol = vol;
        const vlcVol = Math.floor(Math.max(0, Math.min(1, vol)) * 256);
        console.log(`Setting volume: ${vlcVol}`);
        await this.sendCommand(`volume ${vlcVol}`);
    }

    setFile(filepath: string) {
        this.filepath = filepath;
    }

    async resume(): Promise<void> {
        await this._play();
    }

    async play(filepath: string): Promise<void> {
        this.filepath = filepath;
        await this._play();
    }

    async stop(): Promise<void> {
        await this.sendCommand('stop');
        this.firstPlay = true;
    }

    async close(): Promise<void> {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
            this.isSocketConnected = false;
        }
    }
}