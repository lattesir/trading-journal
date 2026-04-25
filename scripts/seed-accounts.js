import "dotenv/config";
import { createMongoClient } from "../src/mongo-client.js";
import { AccountService } from "../src/account-service.js";
import { AccountIdGenerator } from "../src/id-gen.js";
import accountsData from '../seeds/accounts.json' with { type: 'json' };


async function withAccountService(handler) {
    const mongoClient = await createMongoClient(process.env.Mongo_url);
    await mongoClient.connect();
    const db = mongoClient.db("trading-journal");

    const accountService = new AccountService(db);
    accountService.idGenerator = new AccountIdGenerator(db);

    try {
        return await handler(accountService);
    } finally {
        await mongoClient.close();
    }
}

async function main() {
    try{
        await withAccountService(async (accountService) => {
            await accountService.clear();

            for (const input of accountsData) {
                const account = await accountService.createAccount(input);
                console.log(`Create account: ${account.id}`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

main()
