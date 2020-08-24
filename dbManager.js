const _ = require('lodash')
const config = require('./config')
const { prepareBigIntAndBuffer, extractBigIntAndBuffer } = require('./utils/bigInt')
const MongoClient = require('mongodb').MongoClient

class DBManager {
    constructor() {
        const creds = config.db.username
            ? `${encodeURIComponent(config.db.username)}:${encodeURIComponent(config.db.password)}@`
            : ''
        this.url = `mongodb://${creds}${config.db.host}:${config.db.port}/${config.db.options}`
        this.name = config.db.name
        this.collections = config.db.collections
    }

    getCollection(collection) {
        if (this.collections[collection]) {
            return this.collections[collection]
        }

        return collection
    }

    async count(collection, query = {}) {
        query = prepareBigIntAndBuffer(query)
        await this.connect()
        let result = await this.db.collection(this.getCollection(collection)).countDocuments(query)
        result = extractBigIntAndBuffer(result)
        return result
    }

    async aggregate(collection, query) {
        try {
            await this.connect()
            query = prepareBigIntAndBuffer(query)
            let found = await this.db.collection(collection).aggregate(query, { allowDiskUse: true })
            let result = await found.toArray()
            result = extractBigIntAndBuffer(result)
            return result
        } catch (e) {
            console.log(e)
        }
    }

    async isExists(collection, query) {
        await this.connect()
        query = prepareBigIntAndBuffer(query)
        const result = await this.findOne(collection, query)
        if (result) {
            return true
        }

        return false
    }
    async connect() {
        try {
            if (!this.client) {
                this.client = new MongoClient(this.url, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                })
                await this.client.connect()
                this.db = this.client.db(this.name)
            }
        } catch (err) {
            console.log('connect', err)
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close()
            }
        } catch (err) {
            console.log('disconnect', err)
        }
    }

    async clearDB() {
        try {
            await this.connect()
            await this.db.dropDatabase()
            await this.disconnect()
        } catch (err) {
            console.log('clearDB', err)
        }
    }

    async clearCollection(collection) {
        try {
            await this.connect()
            await this.db.collection(this.getCollection(collection)).deleteMany({})
            await this.disconnect()
        } catch (err) {
            console.log('clearCollection', err)
        }
    }

    async insertMany(collection, data) {
        try {
            data = prepareBigIntAndBuffer(data)
            await this.connect()
            const result = await this.db.collection(this.getCollection(collection)).insertMany(data)
            return result
        } catch (err) {
            console.log('insertMany', err)
        }
    }

    async isCounterExists(sequenceName) {
        try {
            await this.connect() // todo mb count?
            const result = await this.db.collection(this.getCollection('counters')).findOne({ _id: sequenceName })
            return result
        } catch (err) {
            console.log('isCounterExists', err)
        }
    }

    async getNextSequenceValue(sequenceName) {
        try {
            const exists = await this.isCounterExists(sequenceName)
            let sequenceDocument
            if (!exists) {
                sequenceDocument = await this.db
                    .collection('counters')
                    .findOneAndUpdate(
                        { _id: sequenceName },
                        { $inc: { seq: 1 } },
                        { projection: { seq: 1 }, upsert: true, returnNewDocument: true },
                    )
            }
            sequenceDocument = await this.db
                .collection('counters')
                .findOneAndUpdate(
                    { _id: sequenceName },
                    { $inc: { seq: 1 } },
                    { projection: { seq: 1 }, upsert: true, returnNewDocument: true },
                )
            return sequenceDocument.value.seq + (sequenceName === 'users' ? 100 : 0) // space for system users
        } catch (err) {
            console.log('getNextSequenceValue', err)
        }
    }

    async insert(collection, data) {
        try {
            data = prepareBigIntAndBuffer(data)
            await this.connect()
            const result = await this.db.collection(this.getCollection(collection)).insertOne(data)
            return result
        } catch (err) {
            console.log('insert', err, { collection, data })
        }
    }

    async deleteOne(collection, filter) {
        try {
            filter = prepareBigIntAndBuffer(filter)
            await this.connect()
            return this.db.collection(this.getCollection(collection)).deleteOne(filter)
        } catch (err) {
            console.log('deleteOne', err, { collection, filter })
        }
    }

    async deleteMany(collection, filter) {
        try {
            filter = prepareBigIntAndBuffer(filter)
            await this.connect()
            return this.db.collection(this.getCollection(collection)).deleteMany(filter)
        } catch (err) {
            console.log('deleteMany', err, { collection, filter })
        }
    }

    async updateOne(collection, query, update, useSet = true) {
        try {
            await this.connect()
            query = prepareBigIntAndBuffer(query)
            update = prepareBigIntAndBuffer(update)
            if (update._id) {
                delete update._id
            }
            if (useSet) {
                update = this.addSetToUpdate(update)
            }
            const result = await this.db.collection(this.getCollection(collection)).updateOne(query, update)
            return result
        } catch (err) {
            console.log('updateOne', err, { collection, query, update })
        }
    }

    async upsertOne(collection, query, update, useSet = true) {
        try {
            await this.connect()
            query = prepareBigIntAndBuffer(query)
            update = prepareBigIntAndBuffer(update)
            if (update._id) {
                delete update._id
            }
            if (useSet) {
                update = this.addSetToUpdate(update)
            }
            const result = await this.db
                .collection(this.getCollection(collection))
                .updateOne(query, update, { upsert: true })
            return result
        } catch (err) {
            console.log('upsertOne', err, { collection, query, update })
        }
    }

    async updateMany(collection, query, update, useSet = true) {
        try {
            await this.connect()
            query = prepareBigIntAndBuffer(query)
            update = prepareBigIntAndBuffer(update)
            if (update._id) {
                delete update._id
            }
            if (useSet) {
                update = this.addSetToUpdate(update)
            }
            const result = await this.db.collection(this.getCollection(collection)).updateMany(query, update)
            return result
        } catch (err) {
            console.log('updateMany', err, { collection, query, update })
        }
    }

    async findAndModify(collection, filter, update) {
        try {
            filter = prepareBigIntAndBuffer(filter)
            update = prepareBigIntAndBuffer(update)
            await this.connect()
            const found = await this.db.collection(this.getCollection(collection)).findOne(filter)
            let result
            if (!found) {
                result = await this.db.collection(this.getCollection(collection)).insertOne(update)
            } else {
                result = await this.db
                    .collection(this.getCollection(collection))
                    .updateOne({ _id: found._id }, { $set: _.merge(found, update) })
            }

            return result
        } catch (err) {
            console.log('findAndModify', err)
        }
    }

    async findAndUpdateMany(collection, filter, update, useSet = true) {
        try {
            filter = prepareBigIntAndBuffer(filter)
            update = prepareBigIntAndBuffer(update)
            if (useSet) {
                update = this.addSetToUpdate(update)
            }
            await this.connect()
            const found = await this.db
                .collection(this.getCollection(collection))
                .find(filter)
                .toArray()
            let result
            if (found.length > 0) {
                const foundIds = found.map(item => item._id)
                await this.db.collection(this.getCollection(collection)).updateMany(filter, update)
                result = await this.db
                    .collection(this.getCollection(collection))
                    .find({ _id: { $in: foundIds } })
                    .toArray()
            } else {
                result = []
            }

            return result
        } catch (err) {
            console.log('findAndUpdateMany', err)
        }
    }

    async findOne(collection, query, options = {}) {
        try {
            await this.connect()
            query = prepareBigIntAndBuffer(query)
            let result = await this.db.collection(this.getCollection(collection)).findOne(query, options)

            result = extractBigIntAndBuffer(result)
            return result
        } catch (err) {
            console.log('findOne', err)
        }
    }

    async find(collection, query, options = {}) {
        try {
            await this.connect()
            query = prepareBigIntAndBuffer(query)
            let result = await this.db
                .collection(this.getCollection(collection))
                .find(query, options)
                .toArray()

            result = extractBigIntAndBuffer(result)
            return result
        } catch (err) {
            console.log('find', err)
        }
    }

    addSetToUpdate(update) {
        const keys = Object.keys(update)
        const newUpdate = {}
        keys.forEach(k => {
            if (k.indexOf('$') !== -1) {
                newUpdate[k] = update[k]
            } else {
                if (newUpdate.$set) {
                    newUpdate.$set[k] = update[k]
                } else {
                    newUpdate.$set = { [k]: update[k] }
                }
            }
        })
        return newUpdate
    }

    async isPrimary() {
        try {
            await this.connect()
            const result = await this.db.command({ isMaster: 1 })
            return result.ismaster
        } catch (err) {
            console.log('isPrimary', err)
        }
    }

    async checkAuth() {
        try {
            await this.connect()
            const result = await this.find('users', {})
            return result ? !!result.length : false
        } catch (err) {
            console.log('checkAuth', err)
        }
    }
}

const db = new DBManager()

module.exports = { db }
