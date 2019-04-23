const {
    createKeys,
    createEOSAccount,
    getBalance,
    createApi,
    createValidation,
    approveValidation,
    issueTokens,
    createTx,
} = require('./crypto')

const { checkEmail, saveUser, getKeys } = require('./db')

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
        const keys = await getKeys(params.uid)
        if (!keys) {
            return { error: { message: 'Invalid uid', code: 4 } }
        }
        const api = createApi(keys)
        try {
            const { txid } = await createValidation(api, params.fromUid, params.toUid, params.amount)
            if (txid) {
                return { result: { txid } }
            }
            const { validationId } = await approveValidation(api, params.fromUid, params.toUid, params.amount)
            const result = await issueTokens(api, params.fromUid, params.toUid, params.amount)
        } catch (err) {
            console.log('create validation error', err)
            return { error: { message: 'internal error, try later', code: 7 } }
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

        const api = createApi(keys)
        try {
            const { txid } = await createTx(api, params.fromUid, params.toUid, params.amount)
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
