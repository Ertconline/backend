const ecc = require('eosjs-ecc')

const createKeys = async () => {
    const privateKey = await ecc.randomKey()
    return { privateKey, pubKey: ecc.privateToPublic(privateKey) }
}

module.exports = { createKeys }
