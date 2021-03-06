module.exports = {
    debug: true,
    db: {
        host: '127.0.0.1',
        port: '27017',
        username: 'admin',
        password: 'admin',
        options: 'test?authSource=ertc&gssapiServiceName=mongodb&readPreference=secondaryPreferred',
        name: 'ertc',
        collections: {},
    },
    eos: {
        chainId: 'b954776664f06dc9986fce64533e28fb9538a8ba008c9e54834ab114c51aadda',
        keyProvider: '5K64tbhRXdt8WqX4eavvtpoTVKSSNXTvDBt4bzH7Mu6c9n4Abof', // faucet active privkey
        adminKeyProvider: '', // ertc active privkey
        httpEndpoint: 'http://127.0.0.1:8888',
    },
    api: {
        ip: '0.0.0.0',
        port: 3100,
        faucetName: 'faucet',
    },
    pointsPartSize: 10,
    ips: ['127.0.0.1'],
}
