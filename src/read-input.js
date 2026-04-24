import readline from 'readline';

export function readInput({ ps1 = 'tj> ', ps2 = '... ' } = {}) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const lines = [];
        let interrupted = false;

        rl.setPrompt(ps1);
        rl.prompt();

        rl.on('line', (line) => {
            if (line !== '') {
                lines.push(line);
                rl.setPrompt(ps2);
                rl.prompt();
                return;
            }

            if (lines.length === 0) {
                rl.setPrompt(ps1);
                rl.prompt();
                return;
            }

            readline.moveCursor(process.stdout, 0, -1);
            rl.close();
            return;
        });

        rl.on('SIGINT', () => {
            interrupted = true;
            rl.close();
        });

        rl.on('close', () => {
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
            if (interrupted) {
                resolve(null);
            } else {
                resolve(lines.join(''));
            }
        });
    });
}
