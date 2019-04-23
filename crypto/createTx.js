const { api } = require('./cryptoApi')

const createTx = async (from, to, amount, memo = '', symbol = 'ERTC') => {
    const tx = {
        actions: [
            {
                account: 'ertc.nft',
                name: 'transfer',
                authorization: [{ actor: from, permission: 'active' }],
                data: { from, to, quantity: `${amount} ${symbol}`, memo },
            },
        ],
    }
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    // console.log('TX:', tx)
    return result.serializedTransaction
}

module.exports = { createTx }
