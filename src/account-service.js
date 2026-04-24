import * as schemas from './schemas.js';

export class AccountService {
    constructor(db) {
        this.accountsCollection = db.collection('accounts');
        this.tradesCollection = db.collection('trades');
    }

    async createAccount(input) {
        const accountDoc = schemas.AccountCreateInput.parse(input);
        accountDoc._id = await this.idGenerator.next();
        await this.accountsCollection.insertOne(accountDoc);
        return accountDoc._id;
    }

    async updateAccount(accountId, patch) {
        const patchDoc = schemas.AccountPatch.parse(patch);
        const accountDoc = await this.accountsCollection.findOneAndUpdate(
            { _id: accountId },
            { $set: patchDoc },
            { returnDocument: 'after' }
        )

        if (!accountDoc) {
            throw new Error(`Account '${accountId}' not found`);
        }

        return this._toAccount(accountDoc);
    }

    async deleteAccount(accountId) {
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

    async listAccounts(filter = {}) {
        const { id, name, type, limit } = schemas.AccountFilter.parse(filter);

        if (id) {
            const accountDoc = await this.accountsCollection.findOne({ _id: id });
            return accountDoc ? [ this._toAccount(accountDoc) ] : [];
        }

        const query = {};

        if (name) {
            query.name = name;
        }

        if (type) {
            query.type = type;
        }

        const accountDocs = await this.accountsCollection
            .find(query)
            .sort({ _id: 1 })
            .limit(limit)
            .toArray();
        
        return accountDocs.map(this._toAccount);
    }

    set idGenerator(value) {
        this._idGenerator = value;
    }

    get idGenerator() {
        if (!this._idGenerator) {
            throw new Error(`idGenerator is missing.`);
        }
        return this._idGenerator;
    }

    _toAccount(accountDoc) {
        const { _id, ...rest } = accountDoc;
        return { id: _id, ... rest };
    }
}
