const prepareBigIntAndBuffer = value => {
    if (value === null || value === undefined) {
        return value
    }
    if (value.constructor && value.constructor.name && value.constructor.name === 'ObjectID') {
        return value
    }
    if (typeof value === 'bigint') {
        return value.toString() + '|BigInt'
    }
    if (typeof value === 'string') {
        return value.replace(/\|BigInt/, '||BigInt').replace(/\|Buffer/, '||Buffer')
    }
    if (Array.isArray(value)) {
        return value.map(v => prepareBigIntAndBuffer(v))
    }
    if (typeof value === 'object') {
        if (value instanceof Buffer) {
            return value.toString('hex') + '|Buffer'
        }
        const keys = Object.keys(value)
        if (!keys.length) {
            return value
        }
        const newObject = Object.assign({}, value)
        keys.forEach(key => {
            newObject[key] = prepareBigIntAndBuffer(value[key])
        })
        return newObject
    }

    return value
}

const extractBigIntAndBuffer = value => {
    if (value === null || value === undefined) {
        return value
    }
    if (typeof value === 'string' && value.indexOf('|BigInt') !== -1 && value.indexOf('||BigInt') === -1) {
        return BigInt(value.toString().replace('|BigInt', ''))
    }
    if (typeof value === 'string' && value.indexOf('|Buffer') !== -1 && value.indexOf('||Buffer') === -1) {
        return Buffer.from(value.replace('|Buffer', ''), 'hex')
    }
    if (typeof value === 'string' && value.indexOf('||BigInt') !== -1) {
        return value.replace(/\|\|BigInt/, '|BigInt')
    }
    if (typeof value === 'string' && value.indexOf('||Buffer') !== -1) {
        return value.replace(/\|\|Buffer/, '|Buffer')
    }
    if (Array.isArray(value)) {
        return value.map(v => extractBigIntAndBuffer(v))
    }
    if (value.constructor && value.constructor.name && value.constructor.name === 'ObjectID') {
        return value
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value)
        if (!keys.length) {
            return value
        }
        const newObject = Object.assign({}, value)
        keys.forEach(key => {
            newObject[key] = extractBigIntAndBuffer(value[key])
        })
        return newObject
    }

    return value
}

module.exports = { prepareBigIntAndBuffer, extractBigIntAndBuffer }
