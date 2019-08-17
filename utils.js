const config = require('./config')
const Decimal = require('decimal.js')
const util = require('util')
const format = require('date-fns/format')
util.inspect.defaultOptions.depth = null

const onlyUnique = (value, index, self) => {
    return self.indexOf(value) === index
}

const parseTokenString = tokenString => {
    const [amountString, symbol] = tokenString.split(' ').map(t => t.trim())
    const amount = amountString
    return { amount, symbol }
}

const generateName = (length = 10, prefix = 'e.') => {
    var text = ''
    var possible = 'abcdefghijklmnopqrstuvwxyz12345'

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return prefix + text
}

const sendError = (res, error) => {
    const response = { success: 0, ...error }
    if (config.debug) {
        console.log(format(Date.now(), 'YYYYMMDD-HH:mm:ss'), 'response', response)
    }
    res.status(500)
    return res.json(response)
}

const sendResult = (res, result) => {
    const response = { success: 1, result }
    if (config.debug) {
        console.log(format(Date.now(), 'YYYYMMDD-HH:mm:ss'), 'response', response)
    }

    return res.json(response)
}

const preparePoint = (point, precision = 8) => {
    let newPoint = new Decimal(point.toString().replace(',', '.'))
    newPoint = newPoint
        .toFixed(precision)
        .toString()
        .replace('.', '')
    newPoint = parseInt(newPoint)
    return newPoint
}

const prepareCoords = coords => {
    const newCoords = coords.map(cs => {
        const coords = {}
        coords.latitude = preparePoint(cs.x)
        coords.longitude = preparePoint(cs.y)
        return coords
    })
    return newCoords
}

const preparePoints = points => {
    const newPoints = points.map(cs => {
        const coords = {}
        coords.latitude = preparePoint(cs[0])
        coords.longitude = preparePoint(cs[1])
        return coords
    })
    return newPoints
}

const prepareCoordsArray = coords => {
    const newCoords = coords.map(cs => {
        const coords = []
        coords.push(cs.x)
        coords.push(cs.y)
        return coords
    })
    return newCoords
}

const isValidCoord = coord => {
    return true
}

const validateCoordsFormat = coords => {
    const newCoords = coords
        .map(cs => {
            const exists = cs.x && cs.y
            const valid = isValidCoord(cs.x) && isValidCoord(cs.y)
            if (exists && valid) {
                return 1
            } else {
                return 0
            }
        })
        .filter(c => c)
    return newCoords.length === coords.length
}

const validateCoordsUniqness = coords => {
    const newCoords = coords
        .map(cs => {
            return cs.x + '|' + cs.y
        })
        .filter(onlyUnique)
    return newCoords.length === coords.length
}

const debug = (...args) => {
    if (config.debug) {
        console.log(format(Date.now(), 'YYYYMMDD-HH:mm:ss'), ...args)
    }
}

const chunk = (arr, len) => {
    const chunks = []
    let i = 0
    const n = arr.length

    while (i < n) {
        chunks.push(arr.slice(i, (i += len)))
    }

    return chunks
}

const bcError = err => {
    if (err.json && err.json.error && err.json.error.details && err.json.error.details.length) {
        return { error: { message: err.json.error.details[0].message, code: 7 } }
    }
    if (err.json && err.json.error && err.json.error.what) {
        if (err.json.error.what === 'token coordinates are not unique') {
            return { error: { message: 'not unique coordinates', code: 12 } }
        }

        return { error: { message: err.json.error.what, code: 7 } }
    }
}

module.exports = {
    parseTokenString,
    generateName,
    sendError,
    sendResult,
    prepareCoords,
    prepareCoordsArray,
    preparePoints,
    validateCoordsFormat,
    validateCoordsUniqness,
    debug,
    chunk,
    bcError,
}
