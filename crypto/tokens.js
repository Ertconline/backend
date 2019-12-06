const { rpc } = require('./cryptoApi')
const { debug, formatCoordFromBC } = require('../utils')

const getTokensByUser = async (uid, skip, limit) => {
    const req = {
        json: true,
        code: 'ertc.nft',
        scope: uid,
        table: 'accounts',
        limit: 10,
    }
    debug('getBalance req', { req })
    const resp = await rpc.get_table_rows(req)
    debug('getBalance resp', { resp })
    const total = resp.rows ? resp.rows[0].balance.split(' ')[0] : 0
    const tokens = []
    if (skip > total) {
        return { total, tokens }
    }
    const ranges = resp.rows[0].tokens.map(t => {
        return { ...t, count: t.second - t.first }
    })
    let skipped = 0
    let fullfiled = 0
    for (const range of ranges) {
        if (fullfiled >= limit) {
            break
        }
        if (skipped + range.count < skip) {
            skipped += range.count
            continue
        }
        const needToSkip = skip - skipped
        const left = limit - fullfiled - 1
        const start = range.first + needToSkip
        const end = left + needToSkip > range.count ? range.second : range.first + needToSkip + left
        const rawTokens = await getTokensByIds(start, end)
        fullfiled += rawTokens.length
        tokens.push(...rawTokens.map(token => formatCoordFromBC(token)))
    }

    return { skip, limit, total, tokens }
}

const getTokensByIds = async (lower, upper) => {
    const req = {
        json: true,
        code: 'ertc.nft',
        scope: 'ertc.nft',
        table: 'token',
        key_type: 'i64',
        index_position: '1',
        lower_bound: lower,
        upper_bound: upper,
        limit: 100,
    }
    debug('getTokensByIds req', { req })
    const resp = await rpc.get_table_rows(req)
    debug('getTokensByIds resp', { resp })

    return resp.rows ? resp.rows : []
}

const getTokensByValid = async validId => {
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
    debug('getTokensByValid', { req })
    const resp = await rpc.get_table_rows(req)
    debug('getTokensByValid', { resp })

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

module.exports = { issueTokens, getTokensByUser }
