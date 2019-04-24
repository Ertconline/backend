const {
    createKeys,
    createEOSAccount,
    getBalance,
    createApi,
    createValidation,
    approveValidation,
    issueTokens,
    createTx,
    getValidation,
    getTokens,
} = require('./crypto')

const { checkEmail, saveUser, getKeys } = require('./db')
const config = require('./config')
const { prepareCoords } = require('./utils')

const methods = {
    createNewUser: async params => {
        if (!params.email) {
            return { error: { message: 'Invalid email', code: 3 } }
        }
        const isAvail = await checkEmail(params.email)
        if (!isAvail) {
            return { error: { message: 'email already registered', code: 6 } }
        }

        try {
            const keys = await createKeys()
            const { uid } = await createEOSAccount(keys.pubKey)
            const result = await saveUser({ email: params.email, keys, uid })
            if (result) {
                return { result: { uid } }
            }
        } catch (err) {
            console.log('create acc error', err)
            return { error: { message: 'internal error, try later', code: 7 } }
        }
    },
    getBalance: async params => {
        if (!params.uid) {
            return { error: { message: 'Invalid uid', code: 4 } }
        }
        const balance = await getBalance(params.uid)
        return { result: { balance: balance[0].amount } }
    },
    validate: async params => {
        if (!params.coords || !params.amount || !params.uid || !params.validNum || !params.validDate) {
            return { error: { message: 'All params required', code: 5 } }
        }

        try {
            const keys = await getKeys(params.uid)
            if (!keys) {
                return { error: { message: 'Invalid uid', code: 4 } }
            }
            const api = createApi(keys.privateKey)
            const AdminApi = createApi(config.eos.adminKeyProvider)
            const newValidation = {
                coords: prepareCoords(params.coords),
                amount: parseInt(params.amount),
                creator: params.uid,
                id: parseInt(params.validNum),
            }

            const validation = await getValidation(newValidation.id)

            if (validation) {
                if (validation.state === 1) {
                    const tokens = await getTokens(newValidation.id)
                    if (!tokens) {
                        const result = await issueTokens(AdminApi, newValidation.id, newValidation.coords)
                        if (result) {
                            return { result: true }
                        }
                    } else {
                        return { result: true }
                    }
                } else {
                    const txId = await approveValidation(AdminApi, newValidation.id)
                    if (txId) {
                        const result = await issueTokens(AdminApi, newValidation.id, newValidation.coords)
                        if (result) {
                            return { result: true }
                        }
                    } else {
                        return {
                            error: {
                                message: 'internal error, try again later',
                                code: 7,
                            },
                        }
                    }
                }
            }

            const valTxId = await createValidation(api, newValidation)
            if (!valTxId) {
                return { error: { message: 'internal error, try again later', code: 7 } }
            }

            const txId = await approveValidation(AdminApi, newValidation.id)
            if (txId) {
                const result = await issueTokens(AdminApi, newValidation.id, newValidation.coords)
                if (result) {
                    return { result: true }
                }
            }

            return { error: { message: 'internal error, try again later', code: 7 } }
        } catch (err) {
            console.log('create validation error', err)
            return { error: { message: 'internal error, try again later', code: 7 } }
        }
    },
    transfer: async params => {
        if (!params.fromUid || !params.toUid || !params.amount) {
            return { error: { message: 'All params required', code: 5 } }
        }

        const keys = await getKeys(params.fromUid)
        if (!keys) {
            return { error: { message: 'Invalid uid', code: 4 } }
        }

        const api = createApi(keys.privateKey)
        try {
            const txid = await createTx(api, {
                from: params.fromUid,
                to: params.toUid,
                amount: parseInt(params.amount),
            })
            if (txid) {
                return { result: { txid } }
            }
        } catch (err) {
            console.log('create tx error', err)
            return { error: { message: 'internal error, try later', code: 7 } }
        }
    },
}

module.exports = { methods }
