"use strict"

const _ = require("lodash"),
    crypto = require("crypto"),
    express = require("express"),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io')(server),
    CONFIRM_MESSAGE = "helloworld"

let peers = [],
    serverSecret = new WeakMap(),
    clientSecret = new WeakMap(),
    sockets = [],
    prevData = null,
    hasPeersConnected = false

//Prevent it from being on there own
if (!process.send) {
    process.exit(0)
}

process.on("uncaughtException", (err)=>{
    if (err.code == "EADDRINUSE") {
        process.exit(0)
    }  
})

process.on("message", (data)=>{
    let msg = JSON.parse(data)
    if (msg.id == "init") {
        init(msg.args)
    } else if (msg.id == "broadcast") {
        sendBroadcastMsg(msg.args)
    }
})

function init(args) {
    if (args != null) {
        peers = args.peers

        io.on("connect", (socket) => {

            socket.on("handServerA", (key) => {
                let bobECDH = crypto.createECDH("secp256k1")
                bobECDH.generateKeys()
                let bobPublicKey = bobECDH.getPublicKey("base64", "compressed")
                serverSecret.set(socket, new Buffer.from(bobECDH.computeSecret(key, "base64", "base64"), "base64").toString("ascii"))
                socket.emit("handClientA", bobPublicKey)
            })

            socket.on("confirm", (_data) => {
                let serverDecipher = crypto.createDecipheriv("aes-256-ctr",serverSecret.get(socket), new Buffer.alloc(16))
                let data = serverDecipher.update(_data, 'base64', 'utf8')
                data += serverDecipher.final("utf8")
                if (data === CONFIRM_MESSAGE) {
                    sockets.push(socket)
                    hasPeersConnected = true
                    if (prevData) {
                        sendBroadcastMsg(prevData, sockets.length - 1)
                    }
                }
            })

            socket.on("disconnect", () => {
                sockets = _.filter(sockets, (o) => o.id !== socket.id)
                if (sockets.length == 0) {
                    hasPeersConnected = false
                }
                _connectToPeers()
            })
        })
        server.listen(args.hostPort || 9000, args.hostAdrs || "localhost", () => process.send(JSON.stringify({id: "start",
            port: server.address().port,
            address: server.address().address})))
        _connectToPeers()
    }
}

function _connectToPeers() {
    for (let i = 0; i < peers.length; i++) {
        try {
            let peer = peers[i]
            let socket = require('socket.io-client')(`http://${peer.host}:${peer.port}/`)
            let aliceECDH = crypto.createECDH("secp256k1")
            aliceECDH.generateKeys()
            let alicePublicKey = aliceECDH.getPublicKey("base64", "compressed")
            socket.emit("handServerA", alicePublicKey) 
           
            socket.on("handClientA", (key) => {
                clientSecret.set(socket, new Buffer.from(aliceECDH.computeSecret(key, "base64", "base64"), "base64").toString("ascii"))
                let clientCipher = crypto.createCipheriv("aes-256-ctr", clientSecret.get(socket), new Buffer.alloc(16))
                let data = clientCipher.update(CONFIRM_MESSAGE, 'utf8', 'base64')
                data += clientCipher.final("base64")
                socket.emit("confirm", data)
            })

            socket.on("db", (obj) => {
                const hmac = crypto.createHmac('sha256', clientSecret.get(socket))
                let clientDecipher = crypto.createDecipheriv("aes-256-ctr", clientSecret.get(socket), new Buffer.alloc(16))
                let data = clientDecipher.update(obj.msg, 'base64', 'utf8')
                data += clientDecipher.final("utf8")
                hmac.update(data)
                const calcHmac = hmac.digest("base64")
                if (obj.verify === calcHmac) {
                    try {
                        let parseData = _toJSON(Object.values(data))
                        parseData = JSON.parse(parseData)
                        prevData = parseData
                        const version = crypto.createHash('md5').update(JSON.stringify(parseData)).digest("hex")
                        process.send(JSON.stringify({id: "netwrokUpdate",
                            data: {version: version, 
                                db: parseData}}))
                    } catch (ex) {
                    }
                }
            })

            socket.on("disconnect", () => {
                socket.connect()
            })

        } catch (err) {
            throw new Error(err)
        }
    }
}

function sendBroadcastMsg(msg, ...args) {
    prevData = msg
    msg = JSON.stringify(msg)
    if (hasPeersConnected) {
        let socket = null, 
            data = null, 
            serverCipher = null
        if (args[0]) {
            socket = sockets[args[0]]
            const hmac = crypto.createHmac('sha256', serverSecret.get(socket))
            hmac.update(msg)
            serverCipher = crypto.createCipheriv("aes-256-ctr", serverSecret.get(socket), new Buffer.alloc(16))
            data = serverCipher.update(msg, 'utf8', 'base64')
            data += serverCipher.final("base64")
            socket.emit("db", {
                verify: hmac.digest("base64"),
                msg: data
            })
        } else {
            for (let i = 0; i < sockets.length; i++) {
                socket = sockets[i]
                const hmac = crypto.createHmac('sha256', serverSecret.get(socket))
                hmac.update(msg)
                serverCipher = crypto.createCipheriv("aes-256-ctr", serverSecret.get(socket), new Buffer.alloc(16))
                data = serverCipher.update(msg, 'utf8', 'base64')
                data += serverCipher.final("base64")
                socket.emit("db", {
                    verify: hmac.digest("base64"),
                    msg: data
                })
            }
        }
    }
}

function _toJSON (json) {
    json = json.join("")
    // Preserve newlines, etc - use valid JSON
    json = json.replace(/\\n/g, "\\n")
        .replace(/\\'/g, "\\'")
        .replace(/\\"/g, '\\"')
        .replace(/\\&/g, "\\&")
        .replace(/\\r/g, "\\r")
        .replace(/\\t/g, "\\t")
        .replace(/\\b/g, "\\b")
        .replace(/\\f/g, "\\f")
    // Remove non-printable and other non-valid JSON chars
    json = JSON.parse(json.replace(/[\u0000-\u0019]+/g, ""))
    return json
}