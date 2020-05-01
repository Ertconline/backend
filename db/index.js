const { db } = require('../dbManager')
const { debug, chunk } = require('../utils')
const config = require('../config')
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

const pointsPartSize = config.pointsPartSize

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
    if (validation) {
        const currentTime = new Date().getTime()
        validation.expired = currentTime > validation.time + 1800000
    }

    return validation
}

const saveValidation = async (data, params) => {
    await db.insert('validations', { id: data.id, data, params })
}

const updateValidationState = async (id, state) => {
    const time = new Date().getTime()
    await db.updateOne('validations', { id }, { $set: { state, time } })
}

const removeValidation = async id => {
    await db.updateOne('validations', { id }, { $set: { state: 'deleted' } })
    await db.deleteMany('pointz', { vid: id })
}

const getTaskById = async id => {
    const task = await db.findOne('tasks', { id })
    if (task) {
        const currentTime = new Date().getTime()
        task.expired = currentTime > task.endTime
    }

    return task
}

const saveOrUpdateTask = async data => {
    const task = await getTaskById(data.id)
    if (!task) {
        return db.insert('tasks', { id: data.id, ...data })
    } else {
        return db.updateOne('tasks', { id: data.id }, { ...data })
    }
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

const getValidationErrors = async vid => {
    const errors = await db.findOne('errors', { vid }, { limit: 1, sort: { date: -1 } })
    return errors
}

const addValidationError = async (vid, error) => {
    const date = new Date()
    const errors = await db.insert('errors', { vid, error, date })
    return errors
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
    saveOrUpdateTask,
    finishTask,
    unfinishTask,
    checkPoints,
    removeValidation,
    updateValidationState,
    getValidationErrors,
    addValidationError,
}
