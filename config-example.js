module.exports = {
    debug: true,
    db: {
        url: 'mongodb://localhost:27017',
        name: 'ertc',
        collections: {},
    },
    eos: {
        chainId: 'b954776664f06dc9986fce64533e28fb9538a8ba008c9e54834ab114c51aadda',
        keyProvider: '5K64tbhRXdt8WqX4eavvtpoTVKSSNXTvDBt4bzH7Mu6c9n4Abof', // faucet active privkey
        httpEndpoint: 'http://127.0.0.1:8888',
    },
    api: {
        ip: '0.0.0.0',
        port: 3100,
        faucetName: 'faucet',
    },
}
