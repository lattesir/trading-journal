import "dotenv/config";
import { createMongoClient } from "../src/mongo-client.js";
import { TradeService } from "../src/trade-service.js";
import { TradeIdGenerator, OrderIdGenerator } from "../src/id-gen.js";
import tradesData from '../seeds/trades.json' with { type: 'json' };


async function reset(db) {
    const tradesCollection = db.collection('trades');
    const countersCollection = db.collection('counters');
    
    await tradesCollection.deleteMany({});
    await countersCollection.deleteMany({ _id: /^[TO]-/ });
}

async function importTrades(db) {
    const tradeService = new TradeService(db);
    tradeService.tradeIdGenerator = new TradeIdGenerator(db);
    tradeService.orderIdGenerator = new OrderIdGenerator(db);

    for (const input of tradesData) {
        const tradeDetail = await tradeService.recordTrade(input);
        console.log(`Record trade: ${tradeDetail.id}`);
    }
}

async function main() {
    const client = await createMongoClient(process.env.Mongo_url);
    await client.connect();
    const db = client.db("trading-journal");

    try{
        await reset(db);
        await importTrades(db);
    } catch (e) {
        console.log(e);
    } finally {
        await client.close();
    }
}

main()
