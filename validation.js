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
} = require('./db')
const {
    validateCoordsFormat,
    validateCoordsUniqness,
    prepareCoordsArray,
    preparePoints,
    debug,
    chunk,
    bcError,
} = require('./utils')
const { getPoints } = require('./points')

const validationStates = { waiting: 0, validated: 1, issued: 2, canceled: 3 }
const pointsPartSize = 1000
const issueRetryTimes = 3
const issueRetryWaitTime = 550
const delay = 550

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
        if (task && task.expired) {
            state.currentUnfinished = true
        } else if (task && task.finished) {
            state.currentFinished = true
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
        if (task && task.expired) {
            state.otherUnfinished = true
        } else if (task && task.finished) {
            state.otherFinished = true
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
            return { result: true }
        }
        const chunks = chunk(preparedPoints, pointsPartSize)
        debug('chunks cnt: ', chunks.length)
        let j = 0
        const estimateOps = chunks.length - Math.ceil(state.issued / pointsPartSize)
        const estimateTimeForOneOp = 300
        const estimate = estimateOps * estimateTimeForOneOp * (issueRetryTimes + 1) // in ms
        const currentTime = new Date().getTime()
        const task = {
            id: newValidationId,
            estimate,
            startTime: currentTime,
            endTime: currentTime + estimate + 1000, // 1 sec just in case
        }
        await saveOrUpdateTask(task)
        debug('current task: ', { task })
        for (const chunk of chunks) {
            if (issued > j * pointsPartSize) {
                j++
                continue
            }
            debug('try issue chunk: ', j)
            const issueResult = await issueTokens(AdminApi, newValidationId, chunk)
            if (issueResult) {
                j++
                continue
            } else {
                debug('try again issue chunk: ', j)
                let success = 0
                for (let i = 0; i <= issueRetryTimes; i++) {
                    debug('try again issue chunk, retry: ', i)
                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve()
                        }, issueRetryWaitTime)
                    })
                    const result = await issueTokens(AdminApi, newValidationId, chunk)
                    if (result) {
                        success = 1
                        break
                    }
                }
                if (!success) {
                    debug('try again issue chunk failed', j)
                    globalSuccess = 0
                    await unfinishTask(newValidationId)
                    break
                }
            }
            j++
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
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve()
            }, delay)
        })
        const txIdPreIssue = await preIssue(AdminApi, newValidationId)
        if (txIdApprove && txIdPreIssue) {
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve()
                }, delay)
            })
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
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve()
            }, delay)
        })
        debug('validation approved, try issue')

        return issueTokensLoop(AdminApi, newValidationId, preparedPoints)
    } else {
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
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve()
                }, delay)
            })
            debug('approveAndIssue success try payout')
            const payoutState = await payout(AdminApi, newValidation.id)
            if (payoutState) {
                return { result: true }
            }
        } else if (result) {
            return result
        }
    } else if (bcValidation.state === validationStates.validated) {
        const currentState = await getIssueState(AdminApi, newValidation.id)
        if (currentState.id !== newValidation.id) {
            const txIdPreIssue = await preIssue(AdminApi, newValidation.id)
            if (txIdPreIssue) {
                await new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve()
                    }, delay)
                })
            } else {
                debug('cant make preissue')
                return { error: { message: 'internal error, try again later', code: 7 } }
            }
        }

        const result = await issueTokensLoop(AdminApi, newValidation.id, preparedPoints)
        if (result && !result.error) {
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve()
                }, delay)
            })
            const payoutState = await payout(AdminApi, newValidation.id)
            if (payoutState) {
                return { result: true }
            }
        } else if (result) {
            return result
        }
    } else if (bcValidation.state === validationStates.issued) {
        return { result: true }
    } else if (bcValidation.state === validationStates.canceled) {
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
                return { error: { message: 'cant create points', code: 11 } }
            }

            preparedPoints = preparePoints(points)
            const check = await checkPoints(preparedPoints)
            if (!check) {
                debug('not unique', { check })
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
            return { error: { message: 'internal error, try again later', code: 7 } }
        }
        debug('bc validation created', newValidation)
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve()
            }, delay)
        })
        const result = await approveAndIssue(AdminApi, newValidation.id, preparedPoints)
        if (result && !result.error) {
            debug('bc validation approved and issued try payout', newValidation)
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve()
                }, delay)
            })
            const payoutState = await payout(AdminApi, newValidation.id)
            if (payoutState) {
                debug('payout success')
                return { result: true }
            }
        } else if (result) {
            return result
        }
    } catch (err) {
        debug('validation error', err)
        const bcErrorMsg = bcError(err)
        if (bcErrorMsg) {
            return bcErrorMsg
        }

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
