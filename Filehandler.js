"use strict"

var fs = require("fs"),
    crypto = require("crypto"),
    SHA3 = require("./sha3")

module.exports = class {
    constructor(args) {
        this.path = args.path
        this.key = new Buffer.from(SHA3.sha3_256(args.key), "hex").toString("ascii")
    }

    getFS() {
        return fs
    }

    genNewKey(newKey, oldKey) {
        if (new Buffer.from(SHA3.sha3_256(oldKey), "hex").toString("ascii") == this.key) {
            this.key = new Buffer.from(SHA3.sha3_256(newKey), "hex").toString("ascii")
        }
        return this.key
    }

    //If callback is null then the file has recently created else the data of the file is past as an object
    init() {
        if (this.exist()) {
            //When file exist transfer content in to memory
            let data = fs.readFileSync(this.path, {
                encoding: "utf8"
            })
            return this.decrypt(data)
        } else {
            //When file doesn't exist make a file
            const fd = fs.openSync(this.path, "w")
            fs.closeSync(fd)
            fs.writeFileSync(this.path, this.encrypt("{}"))
            return null
        }
    }

    write(data) {
        try {
            fs.writeFileSync(this.path, this.encrypt(data))
        } catch (err) {
            onError(err)
        }
    }

    readSync() {
        try {
            return this.decrypt(fs.readFileSync(this.path, 'utf8'))
        } catch (ex) {
            onError(ex)
        }
    }

    encrypt(data) {
        let cipher = crypto.createCipheriv("aes-256-ctr", this.key, new Buffer.alloc(16))
        if (typeof data === 'object') {
            data = JSON.stringify(data)
        }
        let crypted = cipher.update(data, 'utf8', 'base64')
        crypted += cipher.final('base64')
        
        return crypted.toString()
    }

    decrypt(data) {
        let decipher = crypto.createDecipheriv("aes-256-ctr", this.key, new Buffer.alloc(16))
        let dec = decipher.update(data, 'base64', 'utf8')
        dec += decipher.final('utf8');
        
        return this.parse(dec)
    }

    parse(data) {
        //If isJSON is true return parsed data else return just the data
        return this.isJSON(data) ? JSON.parse(data) : data
    }

    /**
     * @author <https://github.com/chriso/validator.js/blob/master/src/lib/isJSON.js>
     */
    isJSON(data) {
        try {
            const obj = JSON.parse(data)
            return !!obj && typeof obj === 'object'
        } catch (e) { /* Ignore */ }
        return false
    }

    exist() {
        try {
            fs.statSync(this.path)
            return true
        } catch (err) {
            return false
        }
    }
}

function onError(err) {
    throw new Error(err)
}