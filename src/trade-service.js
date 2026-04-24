import * as schemas from './schemas.js';


export class TradeService {
    constructor(db) {
        this.accountsCollection = db.collection('accounts');
        this.tradesCollection = db.collection('trades');
        this.countersCollection = db.collection('counters');
        this.tradeFormatter = null;
    }

    async recordTrade(input) {
        const tradeDoc = schemas.RecordTradeInput.parse(input);
        const orders = tradeDoc.orders;
        const lastOrder = orders[orders.length - 1];
        if (lastOrder.type !== 'close') {
            throw new Error('Last order does not close the position.');
        }

        await this._openTrade(tradeDoc);

        this._closeTrade(tradeDoc);

        const tradeId = await this.tradeIdGenerator.next(tradeDoc.startTime);
        tradeDoc._id = tradeId;
        await this._assignOrderIds(tradeDoc.orders, tradeId);

        await this.tradesCollection.insertOne(tradeDoc);
        return this._toTradeDetail(tradeDoc);
    }

    async openTrade(input) {
        const tradeDoc = schemas.OpenTradeInput.parse(input);
        await this._openTrade(tradeDoc);
        
        const tradeId = await this.tradeIdGenerator.next(tradeDoc.startTime);
        tradeDoc._id = tradeId;
        await this._assignOrderIds(tradeDoc.orders, tradeId);

        await this.tradesCollection.insertOne(tradeDoc);
        return tradeDoc._id;
    }

    async appendOrders(tradeId, newOrdersInput) {
        const newOrders = schemas.NewOrdersArray.parse(newOrdersInput);
        const lastOrder = newOrders[newOrders.length - 1];
        if (lastOrder.type === 'close') {
            throw new Error("'close' order is not allowed in appendOrders");
        }

        const tradeDoc = await this.tradesCollection.findOne({ _id: tradeId });
        if (!tradeDoc) {
            throw new Error(`Trade '${tradeId}' not found`)
        }

        this._validateTradeOrders([ ...tradeDoc.orders, ...newOrders ]);

        await this._assignOrderIds(newOrders, tradeId);

        await this.tradesCollection.updateOne(
            { _id: tradeId },
            {
                $push: {
                    orders: { $each: newOrders }
                }
            }
        );
        return tradeId;
    }

    async closeTrade(tradeId, input) {
        const { orders: newOrders, pnl, commission, tags } = schemas.CloseTradeInput.parse(input);

        const tradeDoc = await this.tradesCollection.findOne({ _id: tradeId });
        if (!tradeDoc) {
            throw new Error(`Trade '${tradeId}' not found`)
        }

        tradeDoc.orders = [ ...tradeDoc.orders, ...newOrders ];
        this._validateTradeOrders(tradeDoc.orders);
        
        if (pnl != undefined) {
            tradeDoc.pnl = pnl;
        }

        if (commission != undefined) {
            tradeDoc.commission = commission;
        }

        if (tags) {
            const oldTags = tradeDoc.tags ?? [];
            const newTags = [ ...new Set([ ...oldTags, ...tags ]) ];
            tradeDoc.tags = newTags;
        }

        this._closeTrade(tradeDoc);

        await this.tradesCollection.replaceOne({ _id: tradeId }, tradeDoc);
        return this._toTradeDetail(tradeDoc);
    }

    async _openTrade(tradeDoc) {
        this._validateTradeOrders(tradeDoc.orders);

        const accountDoc = await this.accountsCollection.findOne({ _id: tradeDoc.accountId });
        if (!accountDoc) {
            throw new Error(`Account '${accountDoc._id}' not found`)
        }

        if (tradeDoc.riskBudget == undefined) {
            tradeDoc.riskBudget = accountDoc.initialBalance * accountDoc.riskPercent;
        }

        if (tradeDoc.feeRate == undefined) {
            tradeDoc.feeRate = accountDoc.feeRate;
        }

        if (tradeDoc.tags) {
            tradeDoc.tags = [ ...new Set(tradeDoc.tags) ];
        }

        tradeDoc.startTime = tradeDoc.orders[0].executedAt;
    }

    _closeTrade(tradeDoc) {
        if (tradeDoc.pnl != undefined) {
            tradeDoc.pnlMode = 'manual';
            tradeDoc.commission = tradeDoc.commission ?? 0.0;
        } else {
            let cash = 0;
            let totalTurnover = 0;

            for (const { type, price, amount } of tradeDoc.orders) {
                let sign;

                if (type === 'entry' || type === 'add') {
                    sign = (tradeDoc.direction === 'long' ? -1 : 1);
                } else {
                    sign = (tradeDoc.direction === 'long' ? 1 : -1);
                }

                const turnover = price * amount * tradeDoc.multiplier;
                totalTurnover += turnover;
                cash += sign * turnover;
            }

            const commission = totalTurnover * tradeDoc.feeRate;
            const pnl = cash - commission;
            
            tradeDoc.pnl = pnl;
            tradeDoc.pnlMode = 'auto';
            tradeDoc.commission = commission;
        }

        tradeDoc.rMultiple = tradeDoc.pnl / tradeDoc.riskBudget;

        const orders = tradeDoc.orders;
        const lastOrder = orders[orders.length - 1];
        const endTime = lastOrder.executedAt;
        tradeDoc.endTime = endTime;

        const startTime = tradeDoc.startTime;
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        tradeDoc.duration = duration;
    }

    async updateTags(tradeId, newTags, merge = true) {
        let tags = schemas.Tags.parse(newTags);

        const tradeDoc = await this.tradesCollection.findOne(
            { _id: tradeId },
            { projection: { endTime: true, tags: true } }
        );

        if (!tradeDoc) {
            throw new Error(`Trade '${tradeId}' not found`);
        }

        if (!tradeDoc.endTime) {
            throw new Error("Tags can only be updated for 'closed' trade");
        }

        if (!tags) {
            if (tradeDoc.tags) {
                await this.tradesCollection.updateOne(
                    { _id: tradeId },
                    { $unset: { tags: 1 } }
                );
            }
            return [];
        }

        if (merge) {
            const oldTags = tradeDoc.tags ?? [];
            tags = [ ...new Set([ ...oldTags, ...tags ]) ];
        }

        await this.tradesCollection.updateOne(
            { _id: tradeId },
            { $set: { tags } }
        );
        return tags;
    }

    async deleteTradeById(tradeId) {
        const { deletedCount } = await this.tradesCollection.deleteOne({ _id: tradeId });
        return deletedCount === 1;
    }

    async deleteTradesByAccountId(accountId) {
        const { deletedCount } = await this.tradesCollection.deleteMany({ accountId });
        return deletedCount;
    }

    async deleteAll() {
        const { deletedCount } = await this.tradesCollection.deleteMany({});
        await this.countersCollection.deleteMany({ _id: /^[TO]-/ });
        return deletedCount;
    }

    async showTradeDetail(tradeId) {
        const tradeDoc = await this.tradesCollection.findOne({ _id: tradeId });
        if (!tradeDoc) {
            throw new Error(`Trade ${tradeId} not found`);
        }

        return this._toTradeDetail(tradeDoc);
    }

    async summarizeTrades(filter = {}) {
        const {
            accountId,
            symbol,
            tags,
            timeRange,
            limit
        } = schemas.TradeFilter.parse(filter);

        const pipeline = [];
        
        const match = { endTime: { $exists: true } };
        pipeline.push({ $match: match });

        if (symbol) {
            match.symbol = symbol;
        }

        if (tags) {
            match.tags = { $all: tags };
        }

        if (timeRange?.since) {
            match.endTime.$gte = timeRange.since;
        }

        if (timeRange?.until) {
            match.endTime.$lte = timeRange.until;
        }

        if (limit) {
            pipeline.push({ $sort: { endTime: -1 } });
            pipeline.push({ $limit: limit });
        }

        const group = {};
        pipeline.push({ $group: group });

        if (accountId) {
            match.accountId = accountId;
            group._id = null;
        } else {
            group._id = "$accountId";
        }

        group.totalTrades = { $sum: 1 };
        group.winningTrades = { $sum: { $cond: [{$gt: ["$pnl", 0]}, 1, 0] } };
        group.losingTrades = { $sum: { $cond: [{$lt: ["$pnl", 0]}, 1, 0] } };
        group.totalPnl = { $sum: "$pnl" };
        group.totalProfit = { $sum: { $cond: [{$gt: ["$pnl", 0]}, "$pnl", 0] } };
        group.totalLoss = { $sum: { $cond: [{$lt: ["$pnl", 0]}, { $abs: "$pnl" }, 0] } };
        group.totalCommission = { $sum: "$commission" };
        group.avgPnl = { $avg: "$pnl" };
        group.avgRMultiple = { $avg: "$rMultiple" };
        group.maxWin = { $max: "$pnl" };
        group.maxLoss = { $min: "$pnl" };

        const aggregated = await this.tradesCollection.aggregate(pipeline).toArray();
        if (!aggregated.length) {
            return {};
        }

        let result = {};

        for (const { _id: groupId, ...r } of aggregated) {
            const winRate = r.winningTrades / r.totalTrades;
            const profitFactor = r.totalLoss ? r.totalProfit / r.totalLoss : NaN;
            const summary = { ...r, winRate, profitFactor };
            const formattedSummary = this.tradeFormatter?.formatSummary(summary) ?? summary;
            
            if (groupId) {
                result[groupId] = formattedSummary;
            } else {
                result = formattedSummary;
                break;
            }
        }

        return result;
    }

    async listActiveTrades() {
        return await this.listTrades({ status: 'active' });
    }

    async listRecentTrades(filter = {}) {
        const { accountId, symbol, tags, limit = 3 } = schemas.TradeFilter.parse(filter);
        return await this.listTrades({ accountId, symbol, tags, limit });
    }

    async listTrades(filter = {}) {
        const {
            id,
            accountId,
            symbol,
            tags,
            status,
            timeRange,
            limit = 1000
        } = schemas.TradeFilter.parse(filter);

        if (id) {
            const tradeDoc = await this.tradesCollection.findOne(
                { _id: id },
                { projection: { orders: false } }
            );

            if (!tradeDoc) {
                return [];
            } else if (tradeDoc.endTime) {
                return [ this._toClosedTrade(tradeDoc) ];
            } else {
                return [ this._toActiveTrade(tradeDoc) ];
            }
        }

        const query = {};

        if (accountId) {
            query.accountId = accountId;
        }

        if (symbol) {
            query.symbol = symbol;
        }

        if (tags) {
            query.tags = { $all: tags };
        }

        if (status === 'active') {
            query.endTime = { $exists: false };
            
            const tradeDocs = await this.tradesCollection
                .find(query, { projection: { orders: false } })
                .limit(limit)
                .toArray();

            return tradeDocs.map(this._toActiveTrade);

        } else {
            query.endTime = { $exists: true };

            if (timeRange?.since) {
                query.endTime.$gte = timeRange.since;
            }

            if (timeRange?.until) {
                query.endTime.$lte = timeRange.until;
            }

            const tradeDocs = await this.tradesCollection
                .find(query, { projection: { orders: false } })
                .sort({ endTime: -1 })
                .limit(limit)
                .toArray();

            const trades = tradeDocs.map(this._toClosedTrade);
            
            if (this.tradeFormatter) {
                return trades.map((trade) => this.tradeFormatter.format(trade));
            } else {
                return trades;
            }
        }
    }

    set tradeIdGenerator(value) {
        this._tradeIdGenerator = value;
    }

    get tradeIdGenerator() {
        if (!this._tradeIdGenerator) {
            throw new Error(`tradeIdGenerator is missing.`);
        }
        return this._tradeIdGenerator;
    }

    set orderIdGenerator(value) {
        this._orderIdGenerator = value;
    }

    get orderIdGenerator() {
        if (!this._orderIdGenerator) {
            throw new Error(`orderIdGenerator is missing.`);
        }
        return this._orderIdGenerator;
    }

    async _assignOrderIds(orders, tradeId) {
        for (const order of orders) {
            const orderId = await this.orderIdGenerator.next(tradeId);
            order._id = orderId;
        }
    }

    _validateTradeOrders(orders) {
        for (let i = 1; i < orders.length; i++) {
            const prev = orders[i - 1].executedAt.getTime();
            const curr = orders[i].executedAt.getTime();

            if (curr < prev) {
                throw new Error('Orders must be sorted by executedAt ascending');
            }
        }

        if (orders[0].type !== 'entry') {
            throw new Error("First Order must be 'entry'");
        }

        const lastOrder = orders[orders.length - 1];

        if (orders.length > 1) {
            if (lastOrder.type === 'entry') {
                throw new Error(`Last order must not be 'entry'`);
            }
        }

        for (const order of orders.slice(1, -1)) {
            if (order.type !== 'add' && order.type !== 'reduce') {
                throw new Error("Intermediate orders must be either 'add' or 'reduce'");
            }
        }

        let position = 0;

        for (const order of orders) {
            if (order.type === 'entry' || order.type === 'add') {
                position += order.amount;
            } else {
                position -= order.amount;
                if (position < 0) {
                    throw new Error("Reduce/close amount exceeds current position");
                }
            }
        }

        if (lastOrder.type === 'close' && position !== 0) {
            throw new Error("Position must be fully closed when last order is 'close'");
        }
    }

    _toTradeDetail(tradeDoc) {
        const { _id, ...rest } = tradeDoc;
        return { id: _id, ...rest };
    }

    _toClosedTrade(tradeDoc) {
        const {
            _id,
            accountId,
            symbol,
            direction,
            pnl,
            rMultiple,
            duration,
            tags,
            endTime
        } = tradeDoc;

        return {
            id: _id,
            accountId,
            symbol,
            direction,
            pnl,
            rMultiple,
            duration,
            tags,
            endTime
        }
    }

    _toActiveTrade(tradeDoc) {
        const { _id, symbol, direction, accountId } = tradeDoc;
        return { id: _id, symbol, direction, accountId };
    }
}
