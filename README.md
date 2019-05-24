# omysql

[![defaultExtname](http://img.shields.io/npm/v/omysql.svg)](https://www.npmjs.org/package/omysql)
[![defaultExtname](http://img.shields.io/npm/dm/omysql.svg)](https://www.npmjs.org/package/omysql)

Easy way to use mysql

## How to use.

```powershell
# Install
npm install omysql
```

```javascript
const OMysql = require('omysql');

// init
const mysqlHub = new OMysql({
    connectionLimit: 20,
    host: '127.0.0.1',
    password: '^-^lucky',
    port: 3306,
    user: 'root',
    database: 'testDB'
});

// 1、Query: `where gender = 'male' and age = 18`
const data = mysqlHub.query(['id', 'name'], 'user_info_table', {
    gender: 'male',
    age: 18
});
```
## OMysql

```javascript
const OMysql = require('omysql');

// Generater Sql string
const sqlStr = OMysql.sqlBuilder.query(['id', 'name'], 'user_info_table', {
    gender: 'male',
    age: 18
});

console.log(sqlStr);
/**
 * {
 *      sqlStr: 'SELECT id, name from user_info_table where `gender` = ? and `age` = ?',
 *      params: ['male', 18]
 * }
 */
```

## new OMysql(config)

```javascript
const OMysql = require('omysql');
// init
const omysqlInst = new OMysql({
    connectionLimit: 20,
    host: '127.0.0.1',
    password: '^-^lucky',
    port: 3306,
    user: 'root',
    database: 'testDB'
});
```

### API

#### omysqlInst.setConfig(newConfig)

Update config. Will merge with current config.

#### omysqlInst.createPool(db)

Create mysql pool.

* `db`: Optional. Default `this.config.database`

#### omysqlInst.createConnection(db)

Create mysql connection.

* `db`: Optional. Default `this.config.database`

#### omysqlInst.queryCore(sqlStr, sqlParams, keepConnection)

Execute SQL.

* `sqlStr`: Like `SELECT id, name from user_info_table where `gender` = ? and `age` = ?`, You can use `OMysql.sqlBuilder.query` to generated. `String`
* `sqlParams`: Like `['male', 18]`. `Array`;
* `keepConnection`: Optional, Default `false`. `Boolean`;

#### omysqlInst.query(keys, tableName, condisions, extra)

Query all data by some condisions. Return `false` / `data list`

* `keys`: The keys you want to query(Set `*` to query all keys). Like `['name', 'age']`. `Array`;
* `tableName`: Mysql table name. `String`;
* `condisions`: Query rules. You can use the following ways:
    1. `{[key1]: value1, [key2]: value2}`: Equal to `where key1 = value1 AND key2 = value2`;
    2. `{key: 'id', desc: {rule: '=/</>/<=/>=/!=/like/not like/between/in/not in', params: String|Array}, rel: 'AND/OR'}`: A complex set of conditions;
    3. `[conditions1, condisions2]`: Multiple sets of conditional combinations;
* `extra`: Additional sql string. Like `LIMIT 100`;

#### omysqlInst.queryAll(keys, tableName, extra)

Query all data without condisions. Return `false` / `data list`

* `keys`: The keys you want to query(Set `*` to query all keys). Like `['name', 'age']`. `Array`;
* `tableName`: Mysql table name. `String`;
* `extra`: Additional sql string. Like `LIMIT 100`;

#### omysqlInst.queryOne(keys, tableName, condisions, extra)

The same with `query`, but only return one data. Return `false` / `data`

#### omysqlInst.del(tableName, condisions)

Delete data by some condisions. Return `true`/`false`

#### omysqlInst.insert(tableName, dataset, schema)

Insert data.

#### omysqlInst.insertBatch(tableName, itemKeys, valuesGroup, schema)

Batch insert data.

#### omysqlInst.update(tableName, condisions, dataset, schema)

Update data.

#### omysqlInst.updateOrInsert(tableName, condisions, dataset, schema)

If the target exist, update it, otherwise, insert a new record.

#### omysqlInst.insertIfNeed(tableName, condisions, dataset, schema)

If the target can't find, insert a new record.

#### omysqlInst.beginTransaction(taskCoreFn)

Mysql transaction. Wrap the `taskCoreFn(connection)` with transaction.
