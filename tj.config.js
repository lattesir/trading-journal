import { fileURLToPath } from 'url';
import path from 'path'


const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);


export default {
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    dataDir: path.join(rootDir, 'data'),
    mongoUrl: process.env.Mongo_url || 'mongodb://localhost:27017',

    llm: {
        provider: 'google',
        model: 'gemini-3.5-flash',
        apiKey: process.env.Google_apiKey,
        temperature: 0
    }

    // llm: {
    //     provider: 'openai',
    //     model: 'deepseek/deepseek-v3.2',
    //     apiKey: process.env.OpenRouter_apiKey,
    //     temperature: 0,
    //     configuration: {
    //         baseURL: "https://openrouter.ai/api/v1",
    //     }
    // }
}
