const {
    createKeys,
    createEOSAccount,
    getBalance,
    createApi,
    createTx,
    getValidation,
    payout,
    cancel,
} = require('./crypto')
const { getUser, saveUser, getKeys, saveValidation, getValidationById } = require('./db')
const config = require('./config')
const { prepareCoords, debug, bcError } = require('./utils')
const { isSameAmount, isValid, checkCurrentValidationState, validation, validationStates } = require('./validation')

const methods = {
    createNewUser: async params => {
        if (!params.email) {
            return { error: { message: 'Invalid email', code: 3 } }
        }
        const user = await getUser({ email: params.email })
        if (user) {
            return { result: { uid: user.uid } }
        }

        try {
            const keys = await createKeys()
            const { uid } = await createEOSAccount(keys.pubKey)
            const result = await saveUser({ email: params.email, keys, uid })
            if (result) {
                return { result: { uid } }
            }
        } catch (err) {
            debug('create acc error', err)
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
        const isValidParams = isValid(params)

        if (isValidParams !== true) {
            return isValidParams
        }
        try {
            const keys = await getKeys(params.uid)
            if (!keys) {
                return { error: { message: 'Invalid uid', code: 4 } }
            }
            const api = createApi(keys.privateKey)
            const AdminApi = createApi(config.eos.adminKeyProvider)
            const vid = parseInt(params.validNum)
            let newValidation = await getValidationById(vid)
            if (!newValidation) {
                newValidation = {
                    coords: prepareCoords(params.coords),
                    amount: parseInt(params.amount),
                    creator: params.uid,
                    id: vid,
                }
                await saveValidation(newValidation, params)
            } else {
                newValidation = newValidation.data
            }

            const bcValidation = await getValidation(newValidation.id)

            if (bcValidation) {
                if (bcValidation.state === validationStates.issued) {
                    return { result: true }
                } else if (bcValidation && bcValidation.state === validationStates.canceled) {
                    return {
                        error: {
                            message: 'Validation canceled',
                            code: 15,
                        },
                    }
                }
                const isSameAmountValidation = isSameAmount(bcValidation, newValidation)
                if (isSameAmountValidation !== true) {
                    return isSameAmountValidation
                }
            }

            const waitRetry = 3
            let state = await checkCurrentValidationState(AdminApi, newValidation)
            debug('current state', { state })
            if (state.currentFinished) {
                debug('state: currentFinished')
                return { result: true }
            }
            if (state.currentInProgress) {
                // wait
                debug('state: currentInProgress')
                for (let i = 0; i >= waitRetry; i++) {
                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve()
                        }, state.estimate)
                    })
                    debug('time to check state')
                    state = await checkCurrentValidationState(AdminApi, newValidation)
                    debug('current state after wait', { state })
                    if (state.currentFinished) {
                        if (
                            state.currentFinished &&
                            state.bcState !== validationStates.issued &&
                            state.bcState !== validationStates.canceled
                        ) {
                            await payout(AdminApi, state.id)
                            return { result: true }
                        }
                    }
                    if (state.currentUnfinished) {
                        return validation(bcValidation, newValidation, params, api, AdminApi)
                    }
                }
            }
            if (state.otherInProgress) {
                // wait
                debug('state: otherInProgress')
                for (let i = 0; i >= waitRetry; i++) {
                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve()
                        }, state.estimate)
                    })
                    debug('time to check state')
                    state = await checkCurrentValidationState(AdminApi, newValidation)
                    debug('current state after wait', { state })
                    if (state.currentUnfinished || state.otherFinished) {
                        if (
                            state.otherFinished &&
                            state.bcState !== validationStates.issued &&
                            state.bcState !== validationStates.canceled
                        ) {
                            await payout(AdminApi, state.id)
                        }

                        return validation(bcValidation, newValidation, params, api, AdminApi)
                    }
                }
            }
            if (state.currentUnfinished || state.otherFinished) {
                if (
                    state.otherFinished &&
                    state.bcState !== validationStates.issued &&
                    state.bcState !== validationStates.canceled
                ) {
                    await payout(AdminApi, state.id)
                }
                debug('state: currentUnfinished || otherFinished')
                return validation(bcValidation, newValidation, params, api, AdminApi)
            }
            if (state.otherUnfinished) {
                debug('state: otherUnfinished')
                // procces other
                const bcOtherValidation = await getValidation(state.id)
                let otherValidation = await getValidationById(state.id)
                const keys = await getKeys(otherValidation.params.uid)
                if (!keys) {
                    return { error: { message: 'Other invalid uid', code: 16 } }
                }
                const secondApi = createApi(keys.privateKey)
                const result = await validation(
                    bcOtherValidation,
                    otherValidation.data,
                    otherValidation.params,
                    secondApi,
                    AdminApi,
                )
                if (result.error) {
                    debug('cant validate other', { otherValidation, result })
                    return { error: { message: 'internal error, try again later', code: 7 } }
                } else {
                    return validation(bcValidation, newValidation, params, api, AdminApi)
                }
            }
            debug('cant exit from state', { state })
            return { error: { message: 'internal error, try again later', code: 7 } }
        } catch (err) {
            debug('create validation error', err)
            const bcErrorMsg = bcError(err)
            if (bcErrorMsg) {
                return bcErrorMsg
            }

            return { error: { message: err.message, code: 7 } }
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
    cancel: async params => {
        if (!params.id) {
            return { error: { message: 'All params required', code: 5 } }
        }
        const AdminApi = createApi(config.eos.adminKeyProvider)
        const result = await cancel(AdminApi, params.id)
        if (result) {
            return { result: true }
        }
    },
}

module.exports = { methods }
