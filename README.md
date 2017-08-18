# sjdb - a secure json database

## Install
´´´shell
$ npm install secure_json_database --save
´´´

## Implementing
First initialize a object for your database.
´´´js
var sjdb = require("secure_json_database")

var SecureJsonDB = new sjdb({
    path: "your path.sjson",
    key: "your private key"
})
´´´

### Tables
A table is just a way of organizing your data easily

´´´js
//adding a table to the database
SecureJsonDB.addTable("table name")

//getting all the table names
SecureJsonDB.getAllTableNames()

//getting a javascript object from a table by name
SecureJsonDB.getTable("table name")
´´´

### Manipulating data
Adding data to the database is very simple

´´´js
SecureJsonDB.insert("table name", data)
´´´

Removing data

´´´js
SecureJsonDB.removeAllBy("table name", propertie) //propertie must be a object for example {id: "the id of a entry"}
´´´

Updating a data entry

´´´js
SecureJsonDB.updateByID("table name", "id of the entry", obj) //obj is an object with the uptedated data in it
´´´

### Finding data

´´´js
//finding the first data that has the propertie you give
var data = SecureJsonDB.find("table name", properties) //properties must be an object

//finding the last data that has the propertie you give
var lastData = SecureJsonDB.findLast("table name", properties) //properties must be an object

//finding all data that have the propertie you give
var allData = SecureJsonDB.findAll("table name", properties) //properties must be an object
// allData is an array off all the matched data
´´´

## Examples