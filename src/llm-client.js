const SUPPORTED_PROVIDERS = {
    openai: {
        pkg: "@langchain/openai",
        className: "ChatOpenAI",
    },
    google: {
        pkg: "@langchain/google",
        className: "ChatGoogle",
    }
}

export async function createLLMClient(llmConfig) {
    const { provider, ...options } = llmConfig;

    const target = SUPPORTED_PROVIDERS[provider.toLowerCase()];
    if (!target) {
        throw new Error(`Unsupported LLM provider: ${provider}. ` +
            `Currently supported: ${Object.keys(config).join(", ")}`);
    }

    const module = await import(target.pkg);
    const ModelClass = module[target.className];

    if (!ModelClass) {
        throw new Error(`Could not find class ${target.className} in module ${target.pkg}`);
    }

    return new ModelClass({ ...options });
}
