const config = require('./config')
const Decimal = require('decimal.js')

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
        console.log('response', response)
    }
    res.status(500)
    return res.json(response)
}

const sendResult = (res, result) => {
    const response = { success: 1, result }
    if (config.debug) {
        console.log('response', response)
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

const validateCoords = coords => {
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

module.exports = {
    parseTokenString,
    generateName,
    sendError,
    sendResult,
    prepareCoords,
    prepareCoordsArray,
    preparePoints,
    validateCoords,
}
