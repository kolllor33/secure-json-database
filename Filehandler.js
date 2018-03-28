"use strict";

var fs = require("fs"),
    crypto = require("crypto")

module.exports = class {
    constructor(args) {
        const hash = crypto.createHash('sha512')
        hash.update(args.key)
        this.path = args.path
        this.key = hash.digest('base64')
    }

    getFS() {
        return fs
    }

    genNewKey(newKey) {
        const hash = crypto.createHash('sha512')
        hash.update(newKey)
        this.key = hash.digest('base64')
        return this.key
    }

    //if callback is null then the file has recently created else the data of the file is past as an object
    init() {
        if (this.exist(this.path)) {
            //when file exist transfer content in to memory
            let data = fs.readFileSync(this.path, {
                encoding: "utf8"
            })
            return this.decrypt(data)
        } else {
            //when file doesn't exist make a file
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

    read(callback) {
        fs.readFile(this.path, 'utf8', (err, data) => {
            if (err) {
                onError(err)
            }
            callback(this.decrypt(data))
        })
    }

    readSync() {
        try {
            return this.decrypt(fs.readFileSync(this.path, 'utf8'))
        } catch (ex) {
            onError(ex)
        }
    }

    encrypt(data) {
        let cipher = crypto.createCipher("aes-256-ctr", this.key)

        if (typeof data === 'object') {
            data = JSON.stringify(data)
        }
        let crypted = cipher.update(data, 'utf8', 'base64')
        crypted += cipher.final('base64')

        return crypted.toString()
    }

    decrypt(data) {
        let decipher = crypto.createDecipher("aes-256-ctr", this.key)
        let dec = decipher.update(data, 'base64', 'utf8')
        dec += decipher.final('utf8');

        return this.parse(dec)
    }

    parse(data) {
        //if isJSON is true return parsed data else return just the data
        return this.isJSON(data) ? JSON.parse(data) : data
    }

    /**
     * @author <https://github.com/chriso/validator.js/blob/master/src/lib/isJSON.js>
     */
    isJSON(data) {
        try {
            const obj = JSON.parse(data)
            return !!obj && typeof obj === 'object'
        } catch (e) { /* ignore */ }
        return false
    }

    exist(path) {
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