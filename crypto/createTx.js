const { debug } = require('../utils')

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
    debug('createTx:', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 3600 })
    debug('createTx:', { result })

    return result.transaction_id
}

module.exports = { createTx }
