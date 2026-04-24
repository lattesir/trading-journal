import "dotenv/config";
import { createMongoClient } from "../src/mongo-client.js";
import { AccountService } from "../src/account-service.js";
import { AccountIdGenerator } from "../src/id-gen.js";
import accountsData from '../seeds/accounts.json' with { type: 'json' };


async function reset(db) {
    const accountsCollection = db.collection('accounts');
    const countersCollection = db.collection('counters');
    
    await accountsCollection.deleteMany({});
    await countersCollection.deleteOne({ _id: "account" });
}

async function importAccounts(db) {
    const accountService = new AccountService(db);
    accountService.idGenerator = new AccountIdGenerator(db);
    for (const input of accountsData) {
        const accountId = await accountService.createAccount(input);
        console.log(`Create account ${accountId}: ${input.name}`);
    }
}

async function main() {
    const client = await createMongoClient(process.env.Mongo_url);
    await client.connect();
    const db = client.db("trading-journal");

    try{
        await reset(db);
        await importAccounts(db);
    } catch (e) {
        console.log(e);
    } finally {
        await client.close();
    }
}

main()
