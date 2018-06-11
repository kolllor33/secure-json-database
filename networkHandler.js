"use strict"
const EventEmit = require("events"),
    {fork} = require("child_process")

let hasChild = true,
    child = null

module.exports = class NetHandler extends EventEmit {
    constructor(args) {
        super()
        child = fork("./connectionHandler.js")
        child.send(JSON.stringify({id: "init",
            args: args}))
        child.on('error', (err) => {
            throw new Error("Error in connectionProces: " + err)
        })
        //This handler wil tell if there is allready a process for the connectionhandling  
        child.on('exit', (code, signal) => {
            hasChild = false
        })  
            
        child.on("message", (message)=>{
            let msg = JSON.parse(message)
            if (msg.id == "netwrokUpdate") {
                super.emit("netwrokUpdate", msg.data)
            } else if (msg.id = "start") {
                super.emit("start", msg.address, msg.port)
            }
        })
    }

    sendBroadcast(msg) {
        if (this.hasChild()) {
            child.send(JSON.stringify({id: "broadcast",
                args: msg}))
        }
    }

    hasChild() {
        return hasChild
    }
}