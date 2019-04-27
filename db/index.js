const config = require('../config')
const { appendFileSync, readFileSync, existsSync } = require('fs')

const dbFile = config.dbFile
const users = []

const checkEmail = email => {
    const user = users.find(u => u.email === email)
    return !user
}

const saveUser = async data => {
    users.push(data)
    appendFileSync(dbFile, JSON.stringify(data) + '\r\n')
    return true
}

const getKeys = async uid => {
    const user = users.find(u => u.uid === uid)
    return user && user.keys
}

const loadUsers = async () => {
    const isExists = existsSync(dbFile)
    if (isExists) {
        let rawUsers = readFileSync(dbFile)
        rawUsers = rawUsers
            .toString()
            .split('\r\n')
            .filter(u => u)
            .map(u => JSON.parse(u))
        users.push(...rawUsers)
    }
    if (config.debug) {
        console.log('users loaded', users.length)
    }
}

loadUsers()

module.exports = { checkEmail, saveUser, getKeys }
