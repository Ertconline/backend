const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')
const config = require('./config')

const app = express()
app.use(bodyParser.json())

const methods = {
    createNewUser: async params => {
        if (!params.email) {
            return { error: { message: 'Invalid email', code: 3 } }
        }
    },
    getBalance: async params => {
        if (!params.uid) {
            return { error: { message: 'Invalid uid', code: 4 } }
        }
    },
    validate: async params => {
        if (!params.coords || !params.amount || !params.uid || !params.validNum || !params.validDate) {
            return { error: { message: 'All params required', code: 5 } }
        }
    },
    transfer: async params => {
        if (!params.fromUid || !params.toUid || !params.amount) {
            return { error: { message: 'All params required', code: 5 } }
        }
    },
}

const sendError = (res, error) => {
    return res.json({ success: 0, ...error })
}

const sendResult = (res, result) => {
    return res.json({ success: 1, result })
}

app.post('/api', async (req, res) => {
    const { method, params } = req.body

    if (!methods[method]) {
        return sendError(res, { message: 'Invalid method', code: 1 })
    }

    if (!params) {
        return sendError(res, { message: 'Invalid params', code: 2 })
    }

    const result = await methods[method](params)

    if (result.error) {
        return sendError(res, result.error)
    }

    return sendResult(res, result.result)
})

const server = http.createServer(app)

server.listen(config.api.port, config.api.ip)
server.on('listening', () => {
    console.log('Express server started on port %s at %s', server.address().port, server.address().address)
})
