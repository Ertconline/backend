const config = require('../config')

const createTx = async (api, data) => {
    const pack = {
        from: data.from,
        to: data.to,
        quantity: `${data.amount} ERTC`,
        memo: '',
    }
    const tx = {
        actions: [
            {
                account: 'ertc.nft',
                name: 'transfer',
                authorization: [{ actor: pack.from, permission: 'active' }],
                data: pack,
            },
        ],
    }
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    if (config.debug) {
        console.log('createTx:', { tx, result })
    }

    return result.transaction_id
}

module.exports = { createTx }
