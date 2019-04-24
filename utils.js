const config = require('./config')

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

    return res.json(response)
}

const sendResult = (res, result) => {
    const response = { success: 1, result }
    if (config.debug) {
        console.log('response', response)
    }

    return res.json(response)
}

const prepareCoords = coords => {
    const newCoords = coords.map(cs => {
        const coords = {}
        coords.latitude = parseInt(cs.x.replace(',', ''))
        coords.longitude = parseInt(cs.y.replace(',', ''))
        return coords
    })
    return newCoords
}

module.exports = { parseTokenString, generateName, sendError, sendResult, prepareCoords }
