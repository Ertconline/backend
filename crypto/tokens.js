const { rpc } = require('./cryptoApi')
const config = require('../config')

const getTokens = async validId => {
    const resp = await rpc.get_table_rows({
        json: true,
        code: 'ertc.nft',
        scope: 'ertc.nft',
        table: 'token',
        key_type: 'i64',
        index_position: '2',
        lower_bound: validId,
        upper_bound: validId,
        limit: 1,
    })
    if (config.debug) {
        console.log('getTokens', { resp })
    }

    return resp.rows ? resp.rows[0] : false
}

// cleos push action ertc issue '[0, [[1,1], [2,1], [3,1]]]' -p ertc
const issueTokens = async (api, id, points) => {
    if (config.debug) {
        console.log('issueTokens input', { id, points })
    }
    const pack = { id, points }
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
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    if (config.debug) {
        console.log('issueTokens', { tx, result })
    }

    return result
}

module.exports = { issueTokens, getTokens }
