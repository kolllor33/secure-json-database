"use strict"

const _ = require("lodash"),
    crypto = require("crypto"),
    EventEmit = require("events"),
    express = require("express"),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io')(server),
    CONFIRM_MESSAGE = "helloworld",
    _toJSON = Symbol("toJSON"),
    _connectToPeers = Symbol("connectToPeers")

let peers = [],
    serverSecret = new WeakMap(),
    clientSecret = new WeakMap(),
    sockets = [],
    prevData = null,
    hasPeersConnected = false

module.exports = class NetHandler extends EventEmit {
    constructor(args) {
        super()
        if (args != null) {
            peers = args.peers

            io.on("connect", (socket) => {

                socket.on("handServerA", (key) => {
                    let bobECDH = crypto.createECDH("secp256k1");
                    bobECDH.generateKeys();
                    let bobPublicKey = bobECDH.getPublicKey("base64", "compressed");
                    serverSecret.set(socket, bobECDH.computeSecret(key, "base64", "base64"))

                    socket.emit("handClientA", bobPublicKey)
                })

                socket.on("confirm", (_data) => {
                    let serverDecipher = crypto.createDecipher("aes-256-ctr", serverSecret.get(socket))
                    let data = serverDecipher.update(_data, 'base64', 'utf8')
                    data += serverDecipher.final("utf8")
                    if (data === CONFIRM_MESSAGE) {
                        sockets.push(socket)
                        hasPeersConnected = true
                        if (prevData) {
                            this.sendBroadcast(prevData, sockets.length - 1)
                        }
                    }
                })

                socket.on("disconnect", () => {
                    sockets = _.filter(sockets, (o) => o.id !== socket.id)
                    if (sockets.length == 0) {
                        hasPeersConnected = false
                    }
                })
            })

            server.listen(args.hostPort || 9000, args.hostAdrs || "localhost", () => this.emit("start", server.address().address, server.address().port))
            this[_connectToPeers]()
        }
    }

    [_connectToPeers]() {
        for (let i = 0; i < peers.length; i++) {
            try {
                let peer = peers[i]
                let socket = require('socket.io-client')(`http://${peer.host}:${peer.port}/`)

                let aliceECDH = crypto.createECDH("secp256k1")
                aliceECDH.generateKeys()
                let alicePublicKey = aliceECDH.getPublicKey("base64", "compressed")
                socket.emit("handServerA", alicePublicKey)

                socket.on("handClientA", (key) => {
                    clientSecret.set(socket, aliceECDH.computeSecret(key, "base64", "base64"))
                    let clientCipher = crypto.createCipher("aes-256-ctr", clientSecret.get(socket))

                    let data = clientCipher.update(CONFIRM_MESSAGE, 'utf8', 'base64')
                    data += clientCipher.final("base64")

                    socket.emit("confirm", data)
                })

                socket.on("db", (obj) => {
                    const hmac = crypto.createHmac('sha256', clientSecret.get(socket));
                    let clientDecipher = crypto.createDecipher("aes-256-ctr", clientSecret.get(socket))
                    let data = clientDecipher.update(obj.msg, 'base64', 'utf8')
                    data += clientDecipher.final("utf8")
                    hmac.update(data)
                    if (obj.verify === hmac.digest("base64")) {
                        try {
                            let parseData = this[_toJSON](Object.values(data))
                            parseData = JSON.parse(parseData)
                            prevData = parseData
                            this.emit("netwrokUpdate", parseData)
                        } catch (ex) {

                        }
                    }
                })

                socket.on("disconnect", () => {
                    socket.connect()
                })

            } catch (err) {

            }
        }
    }

    /**
     * Don't use this function it can destroy your data!!!!!!!!!!!!!!
     * Broadcast msg to all the connected sockets if arg is given it is a singelcast 
     * @param {String} msg 
     * @param {Number} args 
     */
    sendBroadcast(msg, ...args) {
        prevData = msg
        msg = JSON.stringify(msg)
        if (hasPeersConnected) {
            let socket = null, 
                data = null, 
                serverCipher = null
            if (args[0]) {
                socket = sockets[args[0]]
                const hmac = crypto.createHmac('sha256', serverSecret.get(socket));
                hmac.update(msg)
                serverCipher = crypto.createCipher("aes-256-ctr", serverSecret.get(socket))
                data = serverCipher.update(msg, 'utf8', 'base64')
                data += serverCipher.final("base64")
                socket.emit("db", {
                    verify: hmac.digest("base64"),
                    msg: data
                })
            } else {
                for (let i = 0; i < sockets.length; i++) {
                    socket = sockets[i]
                    const hmac = crypto.createHmac('sha256', serverSecret.get(socket));
                    hmac.update(msg)
                    serverCipher = crypto.createCipher("aes-256-ctr", serverSecret.get(socket))
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

    [_toJSON](json) {
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
        return json;
    }
}