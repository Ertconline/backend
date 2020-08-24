const express = require('express')
const ipfilter = require('express-ipfilter').IpFilter
const IpDeniedError = require('express-ipfilter').IpDeniedError
const bodyParser = require('body-parser')
const http = require('http')
const config = require('./config')
const { sendError, sendResult, debug } = require('./utils')
const { methods } = require('./methods')
const { db } = require('./dbManager')

const app = express()

let clientIp = function(req, res) {
    const proxyAddr = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null
    const reqAddress = req.connection.remoteAddress || req.ip

    return proxyAddr || reqAddress
}

if (config.ips && config.ips.length) {
    app.use(ipfilter(config.ips, { detectIp: clientIp, mode: 'allow' }))
}

app.use(bodyParser.json())

app.post('/api', async (req, res) => {
    const isPrimary = await db.isPrimary()
    debug('isPrimary:', isPrimary)
    const { method, params } = req.body
    debug('request', req.body)

    if (!isPrimary) {
        return sendError(res, { message: 'instance not primary, use another one', code: 0 })
    }

    if (!methods[method]) {
        return sendError(res, { message: 'Invalid method', code: 1 })
    }

    if (!params) {
        return sendError(res, { message: 'Invalid params', code: 2 })
    }

    const result = await methods[method](params)

    if (result && result.error) {
        return sendError(res, result.error)
    }

    return sendResult(res, result ? result.result : null)
})

app.use((err, req, res, next) => {
    console.log('Error handler', err)
    if (err instanceof IpDeniedError) {
        return sendError(res, { message: 'this ip not allowed', code: 13 })
    } else {
        return sendError(res, { message: 'internal error, try again later', code: 7 })
    }
})

db.connect().then(async () => {
    await db.isPrimary()
    const server = http.createServer(app)
    server.setTimeout(1800000)
    server.listen(config.api.port, config.api.ip)
    server.on('listening', () => {
        console.log('Express server started on port %s at %s', server.address().port, server.address().address)
    })
})
