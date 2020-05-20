const {
    createValidation,
    approveValidation,
    issueTokens,
    getValidation,
    preIssue,
    getIssueState,
    payout,
} = require('./crypto')

const {
    savePreparedPoints,
    getPreparedPoints,
    getTaskById,
    saveOrUpdateTask,
    finishTask,
    unfinishTask,
    checkPoints,
    updateValidationState,
    addValidationError,
} = require('./db')
const {
    validateCoordsFormat,
    validateCoordsUniqness,
    prepareCoordsArray,
    preparePoints,
    debug,
    chunk,
    shiftChunk,
    bcError,
    delay,
} = require('./utils')
const { getPoints } = require('./points')
const config = require('./config')
const validationStates = { waiting: 0, validated: 1, issued: 2, canceled: 3 }
const pointsPartSize = config.pointsPartSize
const issueRetryTimes = 3
const issueRetryWaitTime = 550
const delayTime = 550
const estimateTimeForOneOp = 3000

const checkCurrentValidationState = async (AdminApi, currentValidation) => {
    debug('checkCurrentValidationState', { currentValidation })
    const state = {
        currentInProgress: false,
        currentFinished: false,
        currentUnfinished: false,
        otherInProgress: false,
        otherFinished: false,
        otherUnfinished: false,
        estimate: 0,
        id: 0,
        bcState: 0,
    }
    const bcValidation = await getValidation(currentValidation.id)
    if (bcValidation) {
        if (bcValidation.state === validationStates.issued) {
            state.currentFinished = true
            return state
        } else if (bcValidation.state === validationStates.canceled) {
            state.currentFinished = true
            return state
        }
    }
    const currentState = await getIssueState(AdminApi, currentValidation.id)
    if (!currentState) {
        state.otherFinished = true
        return state
    }
    state.id = currentState.id
    state.bcState = currentState.state
    if (currentState.state === validationStates.issued) {
        state.otherFinished = true
        return state
    } else if (currentState.state === validationStates.canceled) {
        state.otherFinished = true
        return state
    }
    const task = await getTaskById(currentState.id)
    state.estimate = (task && task.estimate) || 0
    debug('task found', { task })
    const isCurrent = currentState.id === currentValidation.id
    if (isCurrent) {
        if (currentState.issued === currentValidation.amount) {
            state.currentFinished = true // mb need payout?
            return state
        }
        if (task && task.finished) {
            state.currentFinished = true
        } else if (task && task.expired) {
            state.currentUnfinished = true
        } else if (task && task.unfinished) {
            state.currentUnfinished = true
        } else if (task) {
            state.currentInProgress = true
        } else {
            state.currentUnfinished = true
        }
    } else {
        const otherValidation = await getValidation(currentState.id)
        if (currentState.issued === otherValidation.amount) {
            state.otherFinished = true // mb need payout?
            return state
        }
        if (task && task.finished) {
            state.otherFinished = true
        } else if (task && task.expired) {
            state.otherUnfinished = true
        } else if (task && task.unfinished) {
            state.otherUnfinished = true
        } else if (task) {
            state.otherInProgress = true
        } else {
            state.otherUnfinished = true
        }
    }

    return state
}

const taskCheck = async task => {
    const currentTime = new Date().getTime()
    if (task.endTime - 1000 <= currentTime) {
        task.endTime = task.endTime + (issueRetryWaitTime * 7 * issueRetryTimes + 1)
        await saveOrUpdateTask(task)
    }
}

const issueTokensLoop = async (AdminApi, newValidationId, preparedPoints) => {
    debug('start issueTokensLoop')
    try {
        const cnt = preparedPoints.length
        const state = await getIssueState(AdminApi, newValidationId)
        let globalSuccess = 1
        const isSameState = state.id === newValidationId
        const issued = isSameState ? state.issued : 0
        if (isSameState && state.issued === cnt) {
            debug('all  issued')
            await finishTask(newValidationId)
            return { result: true }
        }
        const chunks = chunk(preparedPoints, pointsPartSize)
        debug('chunks cnt: ', chunks.length)
        let j = 0
        const estimateOps = Math.abs(chunks.length - Math.ceil(state.issued / pointsPartSize))
        const estimate = Math.abs(estimateOps * estimateTimeForOneOp * (issueRetryWaitTime * 7 * issueRetryTimes + 1)) // in ms
        const currentTime = new Date().getTime()
        const task = {
            id: newValidationId,
            estimate,
            startTime: currentTime,
            endTime: currentTime + estimate + 1001, // 1 sec just in case
        }
        await saveOrUpdateTask(task)
        debug('current task: ', { task })
        for (let chunk of chunks) {
            if (issued > j * pointsPartSize) {
                j++
                continue
            }
            await taskCheck(task)
            debug('try issue chunk: ', j)
            let issueResult
            let shift = 0
            try {
                const stateBefore = await getIssueState(AdminApi, newValidationId)
                issueResult = await issueTokens(AdminApi, newValidationId, chunk)

                await delay(issueRetryWaitTime * 3)

                const stateAfter = await getIssueState(AdminApi, newValidationId)
                if (stateBefore.issued === stateAfter.issued) {
                    debug('issue tokens error', 'same state after issue 1')
                    issueResult = false
                }
            } catch (err) {
                debug('issue tokens error', err)
                const bcErrorMsg = bcError(err)
                if (bcErrorMsg && bcErrorMsg.error.code === 12) {
                    shift = 1
                }
            }
            if (issueResult) {
                j++
                continue
            } else {
                await taskCheck(task)
                debug('try again issue chunk: ', j)
                let success = 0
                for (let i = 0; i <= issueRetryTimes; i++) {
                    debug('try again issue chunk, retry: ', i)
                    await delay(issueRetryWaitTime)
                    await taskCheck(task)
                    try {
                        if (shift) {
                            chunk = shiftChunk(chunk)
                        }
                        const stateBefore = await getIssueState(AdminApi, newValidationId)
                        let issueResult = await issueTokens(AdminApi, newValidationId, chunk)
                        await delay(issueRetryWaitTime * 3)
                        const stateAfter = await getIssueState(AdminApi, newValidationId)
                        if (stateBefore.issued === stateAfter.issued) {
                            debug('issue tokens error', 'same state after issue 2')
                            issueResult = false
                        }
                        if (issueResult) {
                            success = 1
                            break
                        }
                    } catch (err) {
                        debug('issue tokens error', err)
                        const bcErrorMsg = bcError(err)
                        if (bcErrorMsg) {
                            return bcErrorMsg
                        }

                        return { error: { message: err.message, code: 7 } }
                    }
                }
                await taskCheck(task)
                if (!success) {
                    debug('try again issue chunk failed', j)
                    globalSuccess = 0
                    await unfinishTask(newValidationId)
                    break
                }
            }
            j++
            await taskCheck(task)
        }
        if (globalSuccess) {
            await finishTask(newValidationId)
            return { result: true }
        }
    } catch (err) {
        debug('issue tokens error', err)
        const bcErrorMsg = bcError(err)
        if (bcErrorMsg) {
            return bcErrorMsg
        }

        return { error: { message: err.message, code: 7 } }
    }
}

const approveAndPrepare = async (AdminApi, newValidationId) => {
    debug('try approve and prepare')
    try {
        const txIdApprove = await approveValidation(AdminApi, newValidationId)
        await delay(delayTime * 2)
        const txIdPreIssue = await preIssue(AdminApi, newValidationId)
        if (txIdApprove && txIdPreIssue) {
            await delay(delayTime * 2)
            debug('approved and prepared')
            return true
        }
        debug('NOT approved and prepared')
    } catch (err) {
        const bcErrorMsg = bcError(err)
        if (bcErrorMsg) {
            return bcErrorMsg
        }
    }
}

const approveAndIssue = async (AdminApi, newValidationId, preparedPoints) => {
    debug('validation created, try approve')
    const approveState = await approveAndPrepare(AdminApi, newValidationId)
    if (approveState) {
        await delay(delayTime)
        debug('validation approved, try issue')

        return issueTokensLoop(AdminApi, newValidationId, preparedPoints)
    } else {
        debug('validation not approved')
        return {
            error: {
                message: 'internal error, try again later',
                code: 7,
            },
        }
    }
}

const proccessValidation = async (bcValidation, newValidation, AdminApi, preparedPoints) => {
    debug('proccessValidation', { bcValidation, newValidation })

    if (bcValidation.state === validationStates.waiting) {
        const result = await approveAndIssue(AdminApi, newValidation.id, preparedPoints)
        if (result && !result.error) {
            await delay(delayTime * 2)
            debug('approveAndIssue success try payout')
            const state = await getIssueState(AdminApi, newValidation.id)
            if (state.state !== validationStates.issued && state.state !== validationStates.canceled) {
                const payoutState = await payout(AdminApi, newValidation.id)
                if (payoutState) {
                    await updateValidationState(newValidation.id, 'finished')
                    return { result: true }
                }
            } else {
                debug('cant payout 1 wrong state', state)
            }
        } else if (result) {
            await addValidationError(newValidation.id, result)
            return result
        }
    } else if (bcValidation.state === validationStates.validated) {
        const currentState = await getIssueState(AdminApi, newValidation.id)
        if (currentState.id !== newValidation.id) {
            const txIdPreIssue = await preIssue(AdminApi, newValidation.id)
            if (txIdPreIssue) {
                await delay(delayTime)
            } else {
                debug('cant make preissue')
                await addValidationError(newValidation.id, {
                    error: { message: 'internal error, try again later', code: 7 },
                })
                return { error: { message: 'internal error, try again later', code: 7 } }
            }
        }

        const result = await issueTokensLoop(AdminApi, newValidation.id, preparedPoints)
        if (result && !result.error) {
            await delay(delayTime * 2)
            const state = await getIssueState(AdminApi, newValidation.id)
            if (state.state !== validationStates.issued && state.state !== validationStates.canceled) {
                const payoutState = await payout(AdminApi, newValidation.id)
                if (payoutState) {
                    await updateValidationState(newValidation.id, 'finished')
                    return { result: true }
                }
            } else {
                debug('cant payout 2 wrong state', state)
            }
        } else if (result) {
            debug('cant issue tokens')
            await addValidationError(newValidation.id, result)
            return result
        }
    } else if (bcValidation.state === validationStates.issued) {
        return { result: true }
    } else if (bcValidation.state === validationStates.canceled) {
        await addValidationError(newValidation.id, {
            error: {
                message: 'Validation canceled',
                code: 15,
            },
        })
        return {
            error: {
                message: 'Validation canceled',
                code: 15,
            },
        }
    }
}

const validation = async (bcValidation, newValidation, params, api, AdminApi) => {
    debug('validation', { bcValidation, newValidation, params })
    try {
        let preparedPoints = await getPreparedPoints(newValidation.id)
        if (!preparedPoints.length) {
            const coordsArray = prepareCoordsArray(params.coords)
            const points = getPoints(coordsArray, newValidation.amount)

            if (!points.length) {
                await addValidationError(newValidation.id, {
                    error: { message: 'cant create points', code: 11 },
                })
                return { error: { message: 'cant create points', code: 11 } }
            }
            debug('start prepare points')
            preparedPoints = preparePoints(points)

            debug('start check prepared points')
            const check = await checkPoints(preparedPoints)
            if (!check) {
                debug('not unique', { check })
                await addValidationError(newValidation.id, {
                    error: { message: 'not unique coordinates', code: 12 },
                })
                return { error: { message: 'not unique coordinates', code: 12 } }
            }
            await savePreparedPoints(newValidation.id, preparedPoints)
        }
        if (bcValidation) {
            return proccessValidation(bcValidation, newValidation, AdminApi, preparedPoints)
        }
        debug('bc validation not found', newValidation)
        const valTxId = await createValidation(api, newValidation)
        if (!valTxId) {
            await addValidationError(newValidation.id, {
                error: { message: 'internal error, try again later', code: 7 },
            })
            return { error: { message: 'internal error, try again later', code: 7 } }
        }
        debug('bc validation created', newValidation)
        await delay(delayTime)
        const result = await approveAndIssue(AdminApi, newValidation.id, preparedPoints)
        if (result && !result.error) {
            debug('bc validation approved and issued try payout', newValidation)
            await delay(delayTime * 2)
            const state = await getIssueState(AdminApi, newValidation.id)
            if (state.state !== validationStates.issued && state.state !== validationStates.canceled) {
                const payoutState = await payout(AdminApi, newValidation.id)
                if (payoutState) {
                    await updateValidationState(newValidation.id, 'finished')
                    debug('payout success')
                    return { result: true }
                }
            } else {
                debug('cant payout 3 wrong state', state)
            }
        } else if (result) {
            await addValidationError(newValidation.id, result)
            return result
        }
    } catch (err) {
        debug('validation error', err)
        const bcErrorMsg = bcError(err)
        if (bcErrorMsg) {
            await addValidationError(newValidation.id, bcErrorMsg)
            return bcErrorMsg
        }
        await addValidationError(newValidation.id, { error: { message: err.message, code: 7 } })
        return { error: { message: err.message, code: 7 } }
    }
}

const isValid = params => {
    if (!params.coords || !params.amount || !params.uid || !params.validNum || !params.validDate) {
        return { error: { message: 'All params required', code: 5 } }
    }

    if (params.coords.length < 3) {
        return { error: { message: 'coords must be 3 or more', code: 8 } }
    }

    if (!validateCoordsFormat(params.coords)) {
        return {
            error: { message: 'coords must be formatted like {"x": "9.99", "y":"-9.99"}', code: 9 },
        }
    }

    if (!validateCoordsUniqness(params.coords)) {
        return {
            error: { message: 'all coords must be unique', code: 15 },
        }
    }

    if (parseInt(params.amount) < 1) {
        return { error: { message: 'amount must be greater than 0', code: 10 } }
    }

    return true
}

const isSameAmount = (bcValidation, newValidation) => {
    if (newValidation.amount !== bcValidation.amount) {
        return {
            error: {
                message:
                    'Validation already created, but amounts not equal, validation amount: [' +
                    bcValidation.amount +
                    '] new validation amount [' +
                    newValidation.amount +
                    ']',
                code: 14,
            },
        }
    }

    return true
}

module.exports = { isSameAmount, isValid, checkCurrentValidationState, validation, validationStates, approveAndIssue }
