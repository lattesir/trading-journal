import { fileURLToPath } from 'url';
import path from 'path'


const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);

export default {
    timezone: "Asia/Shanghai",
    locale: "zh-CN",

    dataDir: path.join(rootDir, 'data'),
}