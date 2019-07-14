const { rpc } = require('./cryptoApi')
const { parseTokenString, debug } = require('../utils')

const getBalance = async eosName => {
    const balances = [{ amount: '0', symbol: 'ERTC' }]
    try {
        const req = {
            json: true,
            code: 'ertc.nft',
            scope: eosName,
            table: 'accounts',
            limit: 10,
        }
        debug('getBalance error', { req })
        const resp = await rpc.get_table_rows(req)
        debug('getBalance error', { resp })
        const newBalances = []
        for (const balance of resp.rows) {
            newBalances.push(parseTokenString(balance.balance))
        }
        balances.map(x => Object.assign(x, newBalances.find(y => y.symbol === x.symbol)))
    } catch (err) {
        debug('getBalance error', { eosName }, err)
    }

    return balances
}

module.exports = { getBalance }
