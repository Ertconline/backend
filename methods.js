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
const { validateCoords, prepareCoords, prepareCoordsArray, preparePoints } = require('./utils')
const { getPoints } = require('./points')

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
            return { error: { message: 'internal error, try again later', code: 7 } }
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

        if (params.coords.length < 3) {
            return { error: { message: 'coords must be 3 or more', code: 8 } }
        }

        if (!validateCoords(params.coords)) {
            return { error: { message: 'coords must formated like {"x": "9.99", "y":"-9.99"}', code: 9 } }
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
            const coordsArray = prepareCoordsArray(params.coords)
            const validation = await getValidation(newValidation.id)
            const points = getPoints(coordsArray, newValidation.amount)
            const preparedPoints = preparePoints(points)

            if (validation) {
                if (config.debug) {
                    console.log('validation Found', { validation })
                }
                if (validation.state === 0) {
                    const txId = await approveValidation(AdminApi, newValidation.id)
                    if (txId) {
                        await new Promise((resolve, reject) => {
                            setTimeout(() => {
                                resolve()
                            }, 1500)
                        })
                        const result = await issueTokens(AdminApi, newValidation.id, preparedPoints)
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
                } else if (validation.state === 1) {
                    const tokens = await getTokens(newValidation.id)
                    if (!tokens) {
                        const result = await issueTokens(AdminApi, newValidation.id, preparedPoints)
                        if (result) {
                            return { result: true }
                        }
                    } else {
                        return { result: true }
                    }
                } else if (validation.state === 2) {
                    return { result: true }
                }
            }
            if (config.debug) {
                console.log('validation not found')
            }
            const valTxId = await createValidation(api, newValidation)
            if (!valTxId) {
                return { error: { message: 'internal error, try again later', code: 7 } }
            }
            if (config.debug) {
                console.log('validation created, try approve')
            }
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve()
                }, 1500)
            })
            const txId = await approveValidation(AdminApi, newValidation.id)
            if (txId) {
                if (config.debug) {
                    console.log('validation approved, try issue')
                }
                await new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve()
                    }, 1500)
                })
                const result = await issueTokens(AdminApi, newValidation.id, preparedPoints)
                if (result) {
                    return { result: true }
                }
            }

            return { error: { message: 'internal error, try again later', code: 7 } }
        } catch (err) {
            console.log('create validation error', err)
            return { error: { message: err.json.error.what, code: 7 } }
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
            return { error: { message: 'internal error, try again later', code: 7 } }
        }
    },
}

module.exports = { methods }
