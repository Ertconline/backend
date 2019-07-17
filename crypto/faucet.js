const config = require('../config')
const { api } = require('./cryptoApi')
const { generateName, debug } = require('../utils')

const createEOSAccount = async (pubKey, uid = null) => {
    uid = uid || generateName()
    const activeKey = pubKey
    const ownerKey = pubKey
    // TODO check pubkey
    // signup transaction
    const tx = {
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
    }
    debug('createEOSAccount', { tx })
    const result = await api.transact(tx, { blocksBehind: 3, expireSeconds: 30 })
    debug('createEOSAccount', { result })

    return { uid }
}

module.exports = { createEOSAccount }
