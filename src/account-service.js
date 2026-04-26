import * as schemas from './schemas.js';

export class AccountService {
    constructor(db) {
        this.accountsCollection = db.collection('accounts');
        this.tradesCollection = db.collection('trades');
    }

    async save(input) {
        const {
            id,
            name,
            type,
            currency,
            initialBalance,
            feeRate,
            riskPercent
        } = schemas.Account.parse(input);

        if (!id) {
            throw new Error("Account 'id' is required");
        }

        let doc;

        const existing = await this.accountsCollection.findOne({ _id: id });

        if (existing) {
            doc = {
                _id: id,
                name: name ?? existing.name,
                type: type ?? existing.type,
                currency: currency ?? existing.currency,
                initialBalance: initialBalance ?? existing.initialBalance,
                feeRate: feeRate ?? existing.feeRate,
                riskPercent: riskPercent ?? existing.riskPercent
            }
        } else {
            Object.entries({ name, type, currency }).forEach(([ field, value ]) => {
                if (!value) {
                    throw new Error(`Field '${field}' is required when creating account`);
                }
            });

            doc = {
                _id: id,
                name,
                type,
                currency,
                initialBalance: initialBalance ?? 10000,
                feeRate: feeRate ?? 0.0,
                riskPercent: riskPercent ?? 0.02
            }
        }

        await this.accountsCollection.replaceOne({ _id: id }, doc, { upsert: true });
        return this._toAccount(doc);
    }

    async delete(accountId) {
        const associatedTrade = await this.tradesCollection.findOne(
            { accountId },
            { projection: { _id: true } }
        )

        if (associatedTrade) {
            throw new Error('Cannot delete account while associated trades exist.');
        }

        const { deletedCount } = await this.accountsCollection.deleteOne({ _id: accountId });
        return deletedCount === 1;
    }

    async list(filter = {}) {
        const { id, name, type } = schemas.AccountFilter.parse(filter);

        if (id) {
            const doc = await this.accountsCollection.findOne({ _id: id });
            return doc ? [ this._toAccount(doc) ] : [];
        }

        const match = {};

        if (name) {
            match.name = name;
        }

        if (type) {
            match.type = type;
        }

        const docs = await this.accountsCollection
            .find(match)
            .sort({ _id: 1 })
            .toArray();
        
        return docs.map(this._toAccount);
    }

    _toAccount(accountDoc) {
        const { _id, ...rest } = accountDoc;
        return { id: _id, ... rest };
    }
}
