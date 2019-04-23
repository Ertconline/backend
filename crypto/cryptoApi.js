const config = require('../config')
const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextEncoder, TextDecoder } = require('util')

const signatureProvider = new JsSignatureProvider([config.eos.keyProvider])
const rpc = new JsonRpc(config.eos.httpEndpoint, { fetch })
const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
})

const createApi = keys => {
    const signatureProvider = new JsSignatureProvider([keys])
    const rpc = new JsonRpc(config.eos.httpEndpoint, { fetch })
    const api = new Api({
        rpc,
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder(),
    })
    return api
}

module.exports = { signatureProvider, rpc, api, createApi }
