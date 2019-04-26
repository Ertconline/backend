const { rpc } = require('./cryptoApi')
const util = require('util')
util.inspect.defaultOptions.depth = null
const config = require('../config')

// cleos push action ertc create '{"creator": "test1", "id": 0, "coords": [[1, 1], [1, 2], [4, 1], [4, 2]], "amount": 3}' -p test1
const createValidation = async (api, validation) => {
    const tx = {
        actions: [
            {
                account: 'ertc',
                name: 'create',
                authorization: [{ actor: validation.creator, permission: 'active' }],
                data: validation,
            },
        ],
    }
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    if (config.debug) {
        console.log('createValidation', { tx, result })
    }

    return result
}

// cleos push action ertc approve '[0]' -p ertc
const approveValidation = async (api, validId) => {
    const pack = { id: validId }
    const tx = {
        actions: [
            {
                account: 'ertc',
                name: 'approve',
                authorization: [{ actor: 'ertc', permission: 'active' }],
                data: pack,
            },
        ],
    }
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    if (config.debug) {
        console.log('approveValidation', { tx, result })
    }

    return result
}

// cleos get table ertc ertc validation -L8 -U8 -l1
const getValidation = async validId => {
    const request = {
        json: true,
        code: 'ertc',
        scope: 'ertc',
        table: 'validation',
        lower_bound: validId,
        upper_bound: validId,
        limit: 1,
    }
    const resp = await rpc.get_table_rows(request)
    if (config.debug) {
        console.log('getValidation', { request, resp })
    }

    return resp.rows ? resp.rows[0] : false
}

module.exports = { createValidation, approveValidation, getValidation }
