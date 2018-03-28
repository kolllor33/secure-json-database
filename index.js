"use strict";

var _ = require("lodash"),
    fh = require("./Filehandler"),
    EventEmitter = require('events'),
    diff = require("deep-diff")

//private var
let _filehandler = new WeakMap(),
    _path = new WeakMap(),
    _key = new WeakMap(),
    _db = new WeakMap(),
    hasWriteToFile = false

const _update = Symbol("update"),
    _fileWatcher = Symbol("fileWatch")

module.exports = class DB extends EventEmitter {
    constructor(args) {
        super()
        if (args.path && args.key) {
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

            _filehandler.get(this).getFS().watch(this.getPath(), (type, filename) => {
                if (type == "change" && !hasWriteToFile) {
                    this[_fileWatcher]()
                }
            })
        } else {
            throw new Error("Constructor expected: a path and a key in the form of {key: key, path: path}")
        }
    }

    getPath() {
        return _path.get(this)
    }

    changeKey(newKey) {
        if (_key.get(this) !== newKey) {
            _key.set(this, _filehandler.get(this).genNewKey(newKey))
            this[_update]()
        }
    }

    addTable(name) {
        let db = _db.get(this)
        if (db[name] === undefined) {
            db[name] = []
            _db.set(this, db)
            this[_update]()
        }
    }

    getAllTableNames() {
        return Object.keys(_db.get(this))
    }

    getTable(name) {
        let db = _db.get(this)
        if (db[name] == undefined) {
            return
        }
        return db[name]
    }

    insert(tablename, data) {
        try {
            if (data != undefined) {
                let db = _db.get(this)
                if (db[tablename] != undefined) {

                    var isInDB = _.filter(db[tablename], {
                        id: data.id
                    })
                    if (isInDB[0] !== undefined) {
                        return false;
                    }

                    if (!data.id) {
                        data.id = this.genUUID()
                    }
                    db[tablename].push(data)
                    _db.set(this, db)
                    //event emiter
                    this.emit("insert", tablename, data)
                    this[_update]()
                    return true
                } else {
                    throw new Error("Table wasn't created")
                }
            } else {
                console.error("Error: Data was null or undefined!")
                return
            }
        } catch (err) {
            console.log(err)
        }
    }

    removeAllBy(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            var removed = this.findAll(tablename, args)
            _.pullAllBy(db[tablename], removed)
            //event emiter
            this.emit("delete", tablename, removed)
            _db.set(this, db)
            this[_update]()
        } else {
            throw new Error("Table wasn't created")
        }
    }

    updateByID(tablename, id, data) {
        if (data != undefined) {
            let db = _db.get(this)
            if (db[tablename] != undefined) {
                var updated = _.filter(db[tablename], {
                    id: id
                })
                if (updated[0] === undefined) {
                    return
                }
                const index = _.sortedIndexBy(db[tablename], updated[0])
                Object.assign(db[tablename][index], data)
                _db.set(this, db)
                //event emiter
                this.emit("updated", tablename, db[tablename][index])
                this[_update]()
            } else {
                throw new Error("Table wasn't created")
            }
        } else {
            console.error("Error: Data was null or undefined!")
            return
        }
    }

    find(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            return _.find(this.getTable(tablename), args)
        } else {
            throw new Error("Table wasn't created")
        }
    }

    findLast(tablename, args) {
        let db = _db.get(this)
        if (db[name] != undefined) {
            return _.findLast(this.getTable(tablename), args)
        } else {
            throw new Error("Table wasn't created")
        }
    }

    findAll(tablename, args) {
        let db = _db.get(this)
        if (db[tablename] != undefined) {
            return _.filter(this.getTable(tablename), args)
        } else {
            throw new Error("Table wasn't created")
        }
    }

    genUUID() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    //private functions
    [_update]() {
        _filehandler.get(this).write(_db.get(this))
        hasWriteToFile = true
        this.emit("write")
    }

    [_fileWatcher]() {
        let fileData = _filehandler.get(this).readSync()
        if (diff(_db.get(this), fileData)) {
            _db.set(this, fileData)
            hasWriteToFile = false
        }
    }
}