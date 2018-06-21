# sjdb - A secure json database

## Install
```shell
$ npm install secure_json_database --save 
$ npm install secure_json_database
```

## Implementing
First initialize an object for your database.
```js
var sjdb = require("secure_json_database")

var SecureJsonDB = new sjdb({
    path: "your path.sjson",
    key: "your private key"
    //optional
    ,network:{
        peers:[{host:"address", port:"port"},...]
        ,hostAdrs:"address"
        ,hostPort:"port"
    }
})
```
### Network option
The network option has 3 things, peers (has all a list of other servers you want to sync your data with)
hostAdrs is the address of the device that runs this code default to localhost
hostPort is the port you want to listen on default too 9000

Why you wanna use the network option? Because now you can scale your database or service over multiple servers and have data backups automaticly

### Tables
A table is just a way of organizing your data easily

```js
//adding a table to the database
SecureJsonDB.addTable("table name")

//Remove a table and it's data from the database
SecureJsonDB.dropTable("table name")

//getting all the table names
SecureJsonDB.getAllTableNames()

//getting a javascript object from a table by name
SecureJsonDB.getTable("table name")
```

### Manipulating data
Adding data to the database is very simple, latest build you can't insert the same id if the id exists

```js
//returns true if it can write and false when it can't
SecureJsonDB.insert("table name", data)
```

Removing data

```js
SecureJsonDB.removeAllBy("table name", propertie) //propertie must be a object for example {id: "the id of a entry"}
```

Updating a data entry

```js
SecureJsonDB.updateByID("table name", "id of the entry", obj) //obj is an object with the uptedated data in it
```

### Finding data

```js
//finding the first data that has the propertie you give
var data = SecureJsonDB.find("table name", properties) //properties must be an object

//finding the last data that has the propertie you give
var lastData = SecureJsonDB.findLast("table name", properties) //properties must be an object

//finding all data that have the propertie you give
var allData = SecureJsonDB.findAll("table name", properties) //properties must be an object
// allData is an array off all the matched data
```

### Saving and checking passwords

```js
//save the password with id test to the database
SecureJsonDB.savePassWordWithId("password", "test") //test should be unique

//check if password of id(test) in the database equele is to passwordTry and return a boolean
var isCorrect = SecureJsonDB.isPassWordForIdCorrect("passwordTry", "test")
```

### Events

In version 1.1.0 there are events that you can use. The events you can listen on are "insert","updated","delete","write" and "start"

```js
//the insert event is triggerd when you add data to the database
SecureJsonDB.on("insert", function (tablename, InsertedData){

})

//the update event is triggerd when you update data in the database
SecureJsonDB.on("updated", function (tablename, UpdatedData){

})

//the delete event is triggerd when you remove data in the database
SecureJsonDB.on("delete", function (tablename, RemovedData){  //Note: RemovedData is an array of all entries that are removed 

})

//the write event is triggerd when the database is writen to the database file
SecureJsonDB.on("write", function (){

})

//the start event is triggerd when the server is listening and returns the address, port
SecureJsonDB.on("start", function (adrs, port){

})
```

### Changing the Key

You now can change your key of the older databases 

```js
SecureJsonDB.changeKey("the new key")
``` 

## Changelog

In version 1.5 you now can store passwords and check them by referring to them with a username 
like identifier. The encryption used for the procces is pbkdf2. Fixed a bug where cluster network
databases where crashing.

In version 1.4 you now can drop a table from your database. Also there is the network feature
that alows you to sync your database over multiple servers

In version 1.3 you now can use secure_json_database with multi core processes.
Also there are more private methodes and variables added for security reasons.

## Examples

Example code that gives outputs after some manipulation of the data
```js
var sjdb = require("secure_json_database")

//init database object
var SecureJsonDB = new sjdb({
    path: "./test.sjson",
    key: "1234"
})

//add a table called random
SecureJsonDB.addTable("random")

//insert 10 entries in the database 
for (var index = 0; index < 10; index++) {
    if (index % 2 == 0) {
        SecureJsonDB.insert("random", {
            number: index,
            tracker: "track"
        })
    } else {
        SecureJsonDB.insert("random", {
            number: index,
            tracker: "track2"
        })
    }
}
console.log(JSON.stringify(SecureJsonDB.getTable("random")))
/*
Output: [{"number":0,"tracker":"track","id":"3dffb82b-fab5-ec71-40ed-1e335c0c6d0e"},{"number":1,"tracker":"track2","id":"0c59b061-7fcc-5aaf-3404-b0f9e04bebb5"},{"number":2,"tracker":"track","id":"9b38aa89-0f86-b2a3-8e01-378555f0723b"},{"number":3,"tracker":"track2","id":"6f0ca13d-9fa6-7aa9-87e0-5bbe20bafaf5"},{"number":4,"tracker":"track","id":"8303240e-2b0e-af9e-f4d8-de9737794d3d"},{"number":5,"tracker":"track2","id":"44583255-e229-3a51-4c4b-7ca82c6d5e1c"},{"number":6,"tracker":"track","id":"0e72f972-0273-c075-0435-5f4e65b7e56f"},{"number":7,"tracker":"track2","id":"8e93747d-1606-a180-f40c-facd2ee3b3ee"},{"number":8,"tracker":"track","id":"55f5994f-cc55-cfe4-2768-e447eab634dc"},{"number":9,"tracker":"track2","id":"c80abb1a-3185-fb5c-f2ec-45d476cc85ad"}]
*/
SecureJsonDB.updateByID("random", "3dffb82b-fab5-ec71-40ed-1e335c0c6d0e", {
    tracker: "updated"
})
console.log(SecureJsonDB.find("random", {
    tracker: "updated"
}))
/*Output: { number: 0,
  tracker: 'updated',
  id: '3dffb82b-fab5-ec71-40ed-1e335c0c6d0e' }
*/
SecureJsonDB.removeAllBy("random", {
     tracker: "track"
})
console.log(JSON.stringify(SecureJsonDB.getTable("random")))
/*
Output: [{"number":0,"tracker":"updated","id":"3dffb82b-fab5-ec71-40ed-1e335c0c6d0e"},{"number":1,"tracker":"track2","id":"0c59b061-7fcc-5aaf-3404-b0f9e04bebb5"},{"number":3,"tracker":"track2","id":"6f0ca13d-9fa6-7aa9-87e0-5bbe20bafaf5"},{"number":5,"tracker":"track2","id":"44583255-e229-3a51-4c4b-7ca82c6d5e1c"},{"number":7,"tracker":"track2","id":"8e93747d-1606-a180-f40c-facd2ee3b3ee"},{"number":9,"tracker":"track2","id":"60ff12a2-4b89-f2d2-3738-d8d155716574"}]
*/

//Remove table named random and it's data 
SecureJsonDB.dropTable("random")
```