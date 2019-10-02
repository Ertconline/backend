const {
    createKeys,
    createEOSAccount,
    getBalance,
    createApi,
    createTx,
    getValidation,
    payout,
    cancel,
    getIssueState,
    reInState,
} = require('./crypto')
const {
    getUser,
    saveUser,
    getKeys,
    saveValidation,
    getValidationById,
    removeValidation,
    updateValidationState,
    getValidationErrors,
} = require('./db')
const config = require('./config')
const { prepareCoords, debug, bcError } = require('./utils')
const { isSameAmount, isValid, checkCurrentValidationState, validation, validationStates } = require('./validation')

const prepare = async params => {
    const keys = await getKeys(params.uid)
    if (!keys) {
        return { error: { message: 'Invalid uid', code: 4 } }
    }
    const api = createApi(keys.privateKey)
    const AdminApi = createApi(config.eos.adminKeyProvider)
    const vid = params.validNum
    const waitRetry = 3
    let newValidation = await getValidationById(vid)
    if (!newValidation) {
        newValidation = {
            coords: prepareCoords(params.coords),
            amount: parseInt(params.amount),
            creator: params.uid,
            id: vid + '',
        }
        await saveValidation(newValidation, params)
        await updateValidationState(vid, 'new')
    } else {
        if (newValidation.state === 'new' && !newValidation.expired) {
            return { error: { message: 'still in progress', code: 18 } }
        }
        newValidation = newValidation.data
    }

    const bcValidation = await getValidation(newValidation.id)

    if (bcValidation) {
        if (bcValidation.state === validationStates.issued) {
            return { result: true }
        } else if (bcValidation && bcValidation.state === validationStates.canceled) {
            await updateValidationState(vid, 'canceled')
            return {
                error: {
                    message: 'Validation canceled',
                    code: 15,
                },
            }
        }
        const isSameAmountValidation = isSameAmount(bcValidation, newValidation)
        if (isSameAmountValidation !== true) {
            await updateValidationState(vid, 'error')
            return isSameAmountValidation
        }
    }

    let state = await checkCurrentValidationState(AdminApi, newValidation)
    debug('current state', { state })
    if (state.currentFinished) {
        debug('state: currentFinished')
        if (state.bcState !== validationStates.issued && state.bcState !== validationStates.canceled) {
            await payout(AdminApi, state.id)
            await updateValidationState(vid, 'finished')
            return { result: true }
        }

        return { result: true }
    }

    return { state, waitRetry, AdminApi, newValidation, bcValidation, api }
}

const currentInProgress = async (state, waitRetry, AdminApi, newValidation, bcValidation, params, api) => {
    debug('state: currentInProgress')
    for (let i = 0; i <= waitRetry; i++) {
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
                await updateValidationState(state.id, 'finished')
                return { result: true }
            }
        }
        if (state.currentUnfinished) {
            return validation(bcValidation, newValidation, params, api, AdminApi)
        }
    }
}

const otherInProgress = async (state, waitRetry, AdminApi, newValidation, bcValidation, params, api) => {
    debug('state: otherInProgress')
    for (let i = 0; i <= waitRetry; i++) {
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
                await updateValidationState(state.id, 'finished')
            }

            return validation(bcValidation, newValidation, params, api, AdminApi)
        }
    }
}

const currentUnfinished = async (state, AdminApi, newValidation, bcValidation, params, api) => {
    if (
        state.otherFinished &&
        state.bcState !== validationStates.issued &&
        state.bcState !== validationStates.canceled
    ) {
        await payout(AdminApi, state.id)
        await updateValidationState(state.id, 'finished')
    }
    debug('state: currentUnfinished || otherFinished')
    return validation(bcValidation, newValidation, params, api, AdminApi)
}

const otherUnfinished = async (state, AdminApi, newValidation, bcValidation, params, api) => {
    debug('state: otherUnfinished')
    // procces other
    const bcOtherValidation = await getValidation(state.id)
    let otherValidation = await getValidationById(state.id)
    debug('validations:', { bcOtherValidation, otherValidation })
    if (!otherValidation) {
        return { error: { message: 'Other invalid validation', code: 17 } }
    }
    const keys = await getKeys(otherValidation.params.uid)
    if (!keys) {
        return { error: { message: 'Other invalid uid', code: 16 } }
    }
    await updateValidationState(state.id, 'new')
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
            const pack = await prepare(params)
            if (!pack.api) {
                return pack
            }
            const { state, waitRetry, AdminApi, newValidation, bcValidation, api } = pack
            if (state.currentInProgress) {
                return currentInProgress(state, waitRetry, AdminApi, newValidation, bcValidation, params, api)
            }
            if (state.otherInProgress) {
                // wait
                return otherInProgress(state, waitRetry, AdminApi, newValidation, bcValidation, params, api)
            }
            if (state.currentUnfinished || state.otherFinished) {
                return currentUnfinished(state, AdminApi, newValidation, bcValidation, params, api)
            }
            if (state.otherUnfinished) {
                return otherUnfinished(state, AdminApi, newValidation, bcValidation, params, api)
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
    validateAsync: async params => {
        const isValidParams = isValid(params)

        if (isValidParams !== true) {
            return isValidParams
        }
        try {
            const pack = await prepare(params)
            if (!pack.api) {
                return pack
            }
            const { state, waitRetry, AdminApi, newValidation, bcValidation, api } = pack
            if (state.currentInProgress) {
                // wait
                currentInProgress(state, waitRetry, AdminApi, newValidation, bcValidation, params, api)
                return { result: true }
            }
            if (state.otherInProgress) {
                // wait
                otherInProgress(state, waitRetry, AdminApi, newValidation, bcValidation, params, api)
                return { result: true }
            }
            if (state.currentUnfinished || state.otherFinished) {
                currentUnfinished(state, AdminApi, newValidation, bcValidation, params, api)
                return { result: true }
            }
            if (state.otherUnfinished) {
                otherUnfinished(state, AdminApi, newValidation, bcValidation, params, api)
                return { result: true }
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

        try {
            const state = await getIssueState(AdminApi, params.id)
            debug('state', state)
            const issued = state.issued > 0
            if (issued) {
                debug('cant cancel partially issued validation')
                return { error: { message: 'cant cancel partially issued validation', code: 7 } }
            }
            debug('cancel validation', params.id)
            await removeValidation(params.id)
            const result = await cancel(AdminApi, params.id)
            if (result) {
                return { result: true }
            }
        } catch (err) {
            debug('cancel validation error', err)
            const bcErrorMsg = bcError(err)
            if (bcErrorMsg) {
                return bcErrorMsg
            }

            return { error: { message: err.message, code: 7 } }
        }
    },
    getvalidation: async params => {
        const validation = await getValidation(params.id)
        const errors = await getValidationErrors(params.id)
        return { result: { validation, errors } }
    },
    getglobalstate: async params => {
        const AdminApi = createApi(config.eos.adminKeyProvider)
        const state = await getIssueState(AdminApi, params.id)
        return { result: state }
    },
    reinstate: async params => {
        const AdminApi = createApi(config.eos.adminKeyProvider)
        const state = await reInState(AdminApi, params.id)
        return { result: state }
    },
}

module.exports = { methods }
