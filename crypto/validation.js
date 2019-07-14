const { rpc } = require('./cryptoApi')
const { debug } = require('../utils')

// cleos push action ertc create '{"creator": "test1", "id": 0, "coords": [[1, 1], [1, 2], [4, 1], [4, 2]], "amount": 3}' -p test1
const createValidation = async (api, validation) => {
    // validation.coords = validation.coords.map(coord => [coord.latitude + '', coord.longitude + ''])
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
    debug('createValidation', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('createValidation', { result })

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
    debug('approveValidation', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('approveValidation', { result })

    return result
}

const preIssue = async (api, validId) => {
    const pack = { id: validId }
    const tx = {
        actions: [
            {
                account: 'ertc',
                name: 'preissue',
                authorization: [{ actor: 'ertc', permission: 'active' }],
                data: pack,
            },
        ],
    }
    debug('preIssue', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('preIssue', { result })

    return result
}

const payout = async (api, validId) => {
    const pack = { id: validId }
    const tx = {
        actions: [
            {
                account: 'ertc',
                name: 'payout',
                authorization: [{ actor: 'ertc', permission: 'active' }],
                data: pack,
            },
        ],
    }
    debug('payout', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('payout', { result })

    return result
}

const cancel = async (api, validId) => {
    const pack = { id: validId }
    const tx = {
        actions: [
            {
                account: 'ertc',
                name: 'cancel',
                authorization: [{ actor: 'ertc', permission: 'active' }],
                data: pack,
            },
        ],
    }
    debug('cancel', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('cancel', { result })

    return result
}

const getIssueState = async () => {
    const request = {
        json: true,
        code: 'ertc',
        scope: 'ertc',
        table: 'currentstate',
    }
    debug('getIssueState', { request })
    const resp = await rpc.get_table_rows(request)
    debug('getIssueState', { resp })

    return resp.rows ? resp.rows[0] : false
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
    debug('getValidation', { request })
    const resp = await rpc.get_table_rows(request)
    debug('getValidation', { resp })

    return resp.rows ? resp.rows[0] : false
}

module.exports = { createValidation, approveValidation, getValidation, getIssueState, preIssue, payout, cancel }
