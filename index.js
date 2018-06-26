"use strict"
const _ = require("lodash"),
    fh = require("./Filehandler"),
    crypto = require("crypto"),
    netHandler = require("./networkHandler")

//Private var
let _filehandler = new WeakMap(),
    _path = new WeakMap(),
    _key = new WeakMap(),
    _db = new WeakMap(),
    hasWriteToFile = false

const _update = Symbol("update"),
    _fileWatcher = Symbol("fileWatch"),
    PTABLENAME = "PASS"

module.exports = class DB extends netHandler {
    constructor(args) {
        if (args.path && args.key) {
            if (args.network) {
                if (args.network.peers) {
                    super(args.network)
                } else {
                    super(null)
                }
            } else {
                super(null)
            }
            _db.set(this, {})
            _path.set(this, args.path)
            _key.set(this, args.key)
            _filehandler.set(this, new fh({
                path: this.getPath(),
                key: _key.get(this)
            }))

            let data = _filehandler.get(this).init()
            if (data != null) {
                _db.set(this, data)
            }

            _filehandler.get(this).getFS().watchFile(this.getPath(), (curr, prev) => {
                if (!hasWriteToFile && curr.mtime > prev.mtime) {
                    this[_fileWatcher]()
                }
            })
            
            super.on("netwrokUpdate", (netData) => {
                const version = crypto.createHash('md5').update(JSON.stringify(_db.get(this))).digest("hex")
                if (version != netData.version) {
                    let db = _db.get(this)
                    db = netData.db
                    _db.set(this, db)
                    _filehandler.get(this).write(_db.get(this))
                }
            })
        } else {
            throw new Error("Constructor expected: a path and a key in the form of {key: key, path: path}")
        }
    }

    /**
     * Get the path where your database file is stored
     */
    getPath() {
        return _path.get(this)
    }

    /**
     * Change the key of the database. You'll need the old key to change to key
     * @param {String} newKey
     * @param {String} oldKey 
     */
    changeKey(newKey, oldkey) {
        if (_key.get(this) !== newKey) {
            _key.set(this, _filehandler.get(this).genNewKey(newKey, oldkey))
            this[_update]()
        }
    }

    /**
     * Add a table to the database. Also you need to do this for every table in your existing database.
     * @param {String} name 
     */
    addTable(name) {
        try {
            let db = _db.get(this)
            if (db[name] === undefined) {
                db[name] = []
                _db.set(this, db)
                this[_update]()
            }
        } catch (ex) {
            throw new Error("data read from the file is corrupted do you have the right key?")
        }
    }

    /**
     * Get all table names that exist
     */
    getAllTableNames() {
        return Object.keys(_db.get(this))
    }

    /**
     * Get the table in json format
     * @param {String} name 
     */
    getTable(name) {
        let db = _db.get(this)
        if (db[name] == undefined) {
            return
        }
        return db[name]
    }

    /**
     * Delete a specific table
     * @param {String} name 
     */
    dropTable(name) {
        let db = _db.get(this)
        if (db[name] != undefined) {
            db[name] = undefined
        }
    }

    /**
     * Insert data in a specific table
     * @param {String} tablename 
     * @param {Object} data 
     * @returns returns a boolean if the entry was created
     */
    insert(tablename, data) {
        try {
            if (data != undefined) {
                let db = _db.get(this)
                if (db[tablename] != undefined) {

                    let isInDB = _.filter(db[tablename], {
                        id: data.id
                    })
                    if (isInDB[0] !== undefined) {
                        return false
                    }
                    if (!data.id) {
                        data.id = this.genUUID()
                    }
                    db[tablename].push(data)
                    _db.set(this, db)

                    super.emit("insert", tablename, data)
                    this[_update]()
                    return true
                } else {
                    throw new Error("Table wasn't created")
                }
            } else {
                throw new Error("Error: Data was null or undefined!")
            }
        } catch (err) {
            throw new Error(err)
        }
    }

    /**
     * Delete all entries that meet the args
     * @param {String} tablename 
     * @param {Object} args 
     */
    removeAllBy(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            let removed = this.findAll(tablename, args)
            _.pullAllBy(db[tablename], removed)

            super.emit("delete", tablename, removed)
            _db.set(this, db)
            this[_update]()
        } else {
            throw new Error("Table wasn't created")
        }
    }

    /**
     * Update a specific id with the data
     * @param {String} tablename 
     * @param {String} id 
     * @param {Object} data 
     */
    updateByID(tablename, id, data) {
        if (data != undefined) {
            let db = _db.get(this)
            if (db[tablename] != undefined) {
                let updated = _.filter(db[tablename], {
                    id: id
                })
                if (updated[0] === undefined) {
                    return
                }
                const index = _.sortedIndexBy(db[tablename], updated[0])
                Object.assign(db[tablename][index], data)
                _db.set(this, db)

                super.emit("updated", tablename, db[tablename][index])
                this[_update]()
            } else {
                throw new Error("Table wasn't created")
            }
        } else {
            throw new Error("Error: Data was null or undefined!")
        }
    }

    /**
     * Find first entry that match args in a specific table
     * @param {String} tablename 
     * @param {Object} args 
     * @returns returns the matching entry else undefined. you can chain lodash/array functions
     */
    find(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            return _.find(db[tablename], args)
        } else {
            throw new Error("Table wasn't created")
        }
    }

    /**
     * Find last entry that match args in a specific table
     * @param {String} tablename 
     * @param {Object} args 
     * @returns returns the matching entry else undefined. you can chain lodash/array functions
     */
    findLast(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            return _.findLast(db[tablename], args)
        } else {
            throw new Error("Table wasn't created")
        }
    }

    /**
     * Find all entries that match args in a specific table
     * @param {String} tablename 
     * @param {Object} args 
     * @returns returns all matching entries else undefined. you can chain lodash/array functions 
     */
    findAll(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            return _.filter(db[tablename], args)
        } else {
            throw new Error("Table wasn't created")
        }
    }

    /**
     * Save a password to the database, the id is used when decrypting use something that identifies the password like a uniek username.
     * encryption used is pbkdf2(salt=128 randomBytes)
     * @param {String} password 
     * @param {String} id
     */
    savePassWordWithId(password, id) {
        this.addTable(PTABLENAME)
        if (this.find(PTABLENAME, {
            name: id
        })) {
            return
        }
        try {
            let salt = crypto.randomBytes(128).toString("base64")
            let iter = _.random(10000, 50000)
            let derivedKey = crypto.pbkdf2Sync(password, salt, iter, 512, 'sha512')
            this.insert(PTABLENAME, {
                salt: salt,
                name: id,
                iter: iter,
                hash: derivedKey.toString('base64')
            })
        } catch (err) {
            throw new Error("Error when hashing password")
        }
    }

    /**
     * Check the passwordTry if it matches the password stored for id
     * @param {String} passwordTry 
     * @param {String} id 
     * @returns returns a boolean if the password matches this is true else this is false
     */
    isPassWordForIdCorrect(passwordTry, id) {
        let saved = this.find(PTABLENAME, {
            name: id
        })
        if (!saved) {
            return false
        }
        try {
            let derivedKey = crypto.pbkdf2Sync(passwordTry, saved.salt, saved.iter, 512, 'sha512')
            if (derivedKey.toString('base64') === saved.hash) {
                return true
            } else {
                return false
            }
        } catch (err) {
            throw new Error("Error while decrypting password")
        }
    }

    /**
     * Generate a uuid
     */
    genUUID() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1)
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4()
    }

    //Private functions
    [_update]() {
        let db = _db.get(this)
        _filehandler.get(this).write(db)
        if (super.hasChild()) {
            super.sendBroadcast(JSON.stringify(db))
        }
        hasWriteToFile = true
        super.emit("write")
    }
    
    [_fileWatcher]() {
        let fileData = _filehandler.get(this).readSync()
        _db.set(this, fileData)
        if (super.hasChild()) {
            super.sendBroadcast(JSON.stringify(_db.get(this)))
        }
        hasWriteToFile = false
    }
}