import { ChildProcess, spawn } from 'child_process';

export class VlcPlayer {
    proc: ChildProcess | null = null;
    filepath: string = '';

    constructor(
        private vlcPath: string,
        private args: string[],
    ) {}

    _play() {
        this.proc?.kill();
        if (this.filepath !== '') {
            this.proc = spawn(this.vlcPath, [...this.args, this.filepath, '-I', 'dummy', '--loop'], { stdio: ['pipe', 'ignore', 'inherit'] });
        }
    }

    play(filepath: string) {
        this.filepath = filepath;
        this._play();
    }

    stop() {
        this.proc?.kill();
    }
}