const { db } = require('../dbManager')
const { debug, chunk } = require('../utils')
const crypto = require('crypto')
const secret = 'youShallNotPass'

const getUser = async condition => {
    const user = await db.findOne('users', condition)
    return user
}

const saveUser = async data => {
    return db.insert('users', data)
}

const getPreparedPoints = async vid => {
    const points = await db.find('pointz', { vid })
    return points.map(pt => ({ latitude: pt.latitude, longitude: pt.longitude }))
}

const pointsPartSize = 100

const checkPoints = async points => {
    const chunks = chunk(points, pointsPartSize)
    for (const chunk of chunks) {
        const hashes = chunk.map(point => {
            return crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(point))
                .digest('hex')
        })
        const point = await db.findOne('pointz', { hash: { $in: hashes } })
        if (point) {
            debug('not unique coord point:', { points })
            return false
        }
    }

    return true
}

const savePreparedPoints = async (vid, data) => {
    return db.insertMany(
        'pointz',
        data.map(pt => ({
            vid,
            longitude: pt.longitude,
            latitude: pt.latitude,
            hash: crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(pt))
                .digest('hex'),
        })),
    )
}

const getValidationById = async id => {
    const validation = await db.findOne('validations', { id })
    return validation
}

const saveValidation = async (data, params) => {
    await db.insert('validations', { id: data.id, data, params })
}

const getTaskById = async id => {
    const task = await db.findOne('tasks', { id })
    if (task) {
        const currentTime = new Date().getTime()
        task.expired = currentTime > task.endTime
    }

    return task
}

const saveTask = async data => {
    return db.insert('tasks', { id: data.id, ...data })
}

const finishTask = async id => {
    return db.updateOne('tasks', { id }, { finished: true })
}

const unfinishTask = async id => {
    return db.insert('tasks', { id }, { unfinished: true })
}

const getKeys = async uid => {
    const user = await getUser({ uid })
    return user && user.keys
}

module.exports = {
    getUser,
    saveUser,
    getKeys,
    getPreparedPoints,
    savePreparedPoints,
    getValidationById,
    saveValidation,
    getTaskById,
    saveTask,
    finishTask,
    unfinishTask,
    checkPoints,
}
