const { rpc } = require('./cryptoApi')
const { debug } = require('../utils')

const getTokens = async validId => {
    const req = {
        json: true,
        code: 'ertc.nft',
        scope: 'ertc.nft',
        table: 'token',
        key_type: 'i64',
        index_position: '2',
        lower_bound: validId,
        upper_bound: validId,
        limit: 1,
    }
    debug('getTokens', { req })
    const resp = await rpc.get_table_rows(req)
    debug('getTokens', { resp })

    return resp.rows ? resp.rows[0] : false
}

// cleos push action ertc issue '[0, [[1,1], [2,1], [3,1]]]' -p ertc
const issueTokens = async (api, id, points) => {
    const pack = { id, amount: points.length, points }
    const tx = {
        actions: [
            {
                account: 'ertc',
                name: 'issue',
                authorization: [{ actor: 'ertc', permission: 'active' }],
                data: pack,
            },
        ],
    }
    debug('issueTokens', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('issueTokens', { result })

    return result
}

module.exports = { issueTokens, getTokens }
