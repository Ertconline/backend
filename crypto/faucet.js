const config = require('../config')
const { api } = require('./cryptoApi')
const { generateName } = require('../utils')

const createEOSAccount = async pubKey => {
    const uid = generateName()
    const activeKey = pubKey
    const ownerKey = pubKey
    // TODO check pubkey
    // signup transaction + facet giveaway tx
    const result = await api.transact(
        {
            actions: [
                {
                    account: 'eosio',
                    name: 'newaccount',
                    authorization: [{ actor: config.api.faucetName, permission: 'active' }],
                    data: {
                        creator: config.api.faucetName,
                        name: uid,
                        owner: { threshold: 1, keys: [{ key: ownerKey, weight: 1 }], accounts: [], waits: [] },
                        active: { threshold: 1, keys: [{ key: activeKey, weight: 1 }], accounts: [], waits: [] },
                    },
                },
            ],
        },
        { blocksBehind: 3, expireSeconds: 30 },
    )
    // todo check result
    // console.log({ txresult: result, nick })
    return { uid }
}

module.exports = { createEOSAccount }
