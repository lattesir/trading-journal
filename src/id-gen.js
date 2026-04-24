export class AccountIdGenerator {
    constructor(db) {
        this.collection = db.collection('counters');
    }

    async next() {
        const { seq } = await this.collection.findOneAndUpdate(
            { _id: `account` },
            { $inc: { seq: 1 } },
            { 
                upsert: true,
                returnDocument: "after"
            }
        );

        return `A-${String(seq).padStart(2, '0')}`
    }
}

export class TradeIdGenerator {
    constructor(db) {
        this.collection = db.collection('counters');
    }

    async next(dateObj) {
        const yyyymmdd = this.formatToYYYYMMDD(dateObj);
        const id = `T-${yyyymmdd}`;

        const { seq } = await this.collection.findOneAndUpdate(
            { _id: id },
            { $inc: { seq: 1 } },
            {
                upsert: true,
                returnDocument: "after"
            }
        );

        return `${id}-${String(seq).padStart(2, '0')}`
    }

    formatToYYYYMMDD(d) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
}

export class OrderIdGenerator {
    constructor(db) {
        this.collection = db.collection('counters');
    }

    async next(tradeId) {
        const id = `O-${tradeId.slice(2)}`;

        const { seq } = await this.collection.findOneAndUpdate(
            { _id: id },
            { $inc: { seq: 1 } },
            { 
                upsert: true,
                returnDocument: "after"
            }
        );

        return `${id}-${String(seq).padStart(2, '0')}`
    }
}
