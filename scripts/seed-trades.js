import "dotenv/config";
import { createMongoClient } from "../src/mongo-client.js";
import { TradeService } from "../src/trade-service.js";
import { TradeIdGenerator, OrderIdGenerator } from "../src/id-gen.js";
import tradesData from '../seeds/trades.json' with { type: 'json' };


async function withTradeService(handler) {
    const mongoClient = await createMongoClient(process.env.Mongo_url);
    await mongoClient.connect();
    const db = mongoClient.db("trading-journal");

    const tradeService = new TradeService(db);
    tradeService.tradeIdGenerator = new TradeIdGenerator(db);
    tradeService.orderIdGenerator = new OrderIdGenerator(db);

    try {
        return await handler(tradeService);
    } finally {
        await mongoClient.close();
    }
}

async function main() {
    try {
        await withTradeService(async (tradeService) => {
            await tradeService.deleteAll();

            for (const input of tradesData) {
                const tradeDetail = await tradeService.recordTrade(input);
                console.log(`Record trade: ${tradeDetail.id}`);
            }
        })
    } catch (e) {
        console.error(e);
    }
}

main()
