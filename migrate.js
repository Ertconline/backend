const { db } = require('./dbManager')
const { readFileSync, existsSync } = require('fs')
const dbFile = './users/users.json'
const loadUsers = async () => {
    const isExists = existsSync(dbFile)
    if (isExists) {
        let rawUsers = readFileSync(dbFile)
        rawUsers = rawUsers
            .toString()
            .split('\r\n')
            .filter(u => u)
            .map(u => JSON.parse(u))
        return rawUsers
    }
}

db.connect().then(async () => {
    const users = await loadUsers()
    await db.insertMany('users', users)
    console.log('finish')
})
