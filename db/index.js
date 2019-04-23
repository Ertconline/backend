const { db } = require('../dbManager')

const table = 'users'

const checkEmail = async email => {
    const user = await db.findOne(table, { email })
    return !user
}

const saveUser = async data => {
    const result = await db.insert(table, data)
    return result.result.ok
}

const getKeys = async uid => {
    const user = await db.findOne(table, { uid })
    return user && user.keys
}

module.exports = { checkEmail, saveUser, getKeys }
