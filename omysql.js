'use strict';

const mysql = require('mysql2/promise');
const sqlParamsBuilder = require('./sql-builder');

class OMysql {
    constructor (props) {
        this.config = Object.assign({
            connectionLimit: 20,
            host: null,
            password: null,
            port: 3306,
            user: null,
            database: null
        }, props);
    };
    setConfig (config) {
        this.config = Object.assign(this.config, config);
    };
    async createPool (db) {
        const { config } = this;
        try {
            return await mysql.createPool({
                connectionLimit: 20,
                host: config.host,
                password: config.password,
                port: config.port,
                user: config.user,
                database: db || config.database
            });
        }
        catch (e) {
            return Promise.reject(e.message || 'Create Pool failed.');
        }
    };
    async createConnection (db) {
        const pool = await this.createPool(db);
        return pool.getConnection();
    };
    // Execute SQL.
    async queryCore (queryStr, params = [], keepConnection) {
        const connection = await this.createConnection();
        const result = await connection.execute(
            queryStr,
            params
        );
        if (keepConnection) {
            return {
                connection,
                result: result[0]
            };
        }
        connection.release();
        return result[0];
    };
    /**
     * Query
     * @param  {[type]} items     [description]
     * @param  {[type]} tableName [description]
     * @param  {Array} filters   查找条件
     *         [
     *                Object => {key: 'id', desc: {rule: '=/</>/<=/>=/between/in', params: String|Array => [对应值]}, rel: 'AND/OR'},
     *                Object => {type: 'group', filters: [xxx], rel: 'AND/OR'}
     *          ]
     * @param  {String} extra     补充说明，如LIMIT xxx, ORDER BY xxxx
     * @return {[type]}           [description]
     */
    async query (items, tableName, filters, extra) {
        let queryParams = sqlParamsBuilder.query(items, tableName, filters, extra);
        if (!queryParams) {
            return false;
        }
        const res = await this.queryCore(queryParams.sqlStr, queryParams.params);
        return res;
    };

    async queryAll (items, tableName, extra) {
        let queryParams = sqlParamsBuilder.queryAll(items, tableName, extra);
        if (!queryParams) {
            return false;
        }
        const res = await this.queryCore(queryParams.sqlStr, queryParams.params);
        return res;
    };

    // Query one，return `false` if is not exist.
    async queryOne (items, tableName, filters) {
        let queryParams = sqlParamsBuilder.queryOne(items, tableName, filters);
        if (!queryParams) {
            return false;
        }
        const result = (await this.queryCore(queryParams.sqlStr, queryParams.params));
        return result[0];
    };
    async del (tableName, filters) {
        let queryParams = sqlParamsBuilder.del(tableName, filters);
        if (!queryParams) {
            return false;
        }
        await this.queryCore(queryParams.sqlStr, queryParams.params);
        return true;
    };

    /**
     * Insert a piece of data，and return the one "id"
     * @param  {[type]}  tableName [description]
     * @param  {[type]}  items     [description]
     * @param  {[type]}  schema    [description]
     * @return {Promise}           [description]
     */
    async insert (tableName, items, schema) {
        let queryParams = sqlParamsBuilder.insert(tableName, items, schema);
        if (!queryParams) {
            return false;
        }
        const { connection } = await this.queryCore(queryParams.sqlStr, queryParams.params, true);
        let [lastInsertId] = await connection.execute(
            'SELECT LAST_INSERT_ID()',
            []
        );
        connection.release();
        lastInsertId = lastInsertId && lastInsertId[0]['LAST_INSERT_ID()'];
        if (typeof lastInsertId !== 'number') {
            lastInsertId = false;
        }
        return lastInsertId;
    };

    /**
     * 批量插入
     * @param  {String}  tableName  表名
     * @param  {Array(String)}  itemKeys   插入的字段名
     * @param  {Array(Array)}  valuesGroup 批量注入的值列表，单组值与itemKeys一一对应
     * @param  {[type]}  schema     [description]
     * @return {Promise}            [description]
     */
    async insertBatch (tableName, itemKeys, valuesGroup, schema) {
        let queryParams = sqlParamsBuilder.insertBatch(tableName, itemKeys, valuesGroup, schema);
        if (!queryParams) {
            return false;
        }
        await this.queryCore(queryParams.sqlStr, queryParams.params);
        return true;
    };

    async update (tableName, filters, items, schema) {
        let queryParams = sqlParamsBuilder.update(tableName, filters, items, schema);
        if (!queryParams) {
            return false;
        }
        await this.queryCore(queryParams.sqlStr, queryParams.params);
        return true;
    };

    async updateOrInsert (tableName, filters, items, schema) {
        if (!tableName || !items || !Object.keys(items).length) {
            return false;
        }
        let itemId = false;
        if (!filters) {
            itemId = await this.insert(tableName, items, schema);
        }
        else {
            if (!Array.isArray(filters)) {
                filters = [filters];
            }
            let exsitOne = await this.queryOne('*', tableName, filters);
            // 存在则走更新策略
            if (exsitOne) {
                await this.update(tableName, filters, items, schema);
                itemId = exsitOne.id;
            }
            else {
                itemId = await this.insert(tableName, items, schema);
            }
        }
        return itemId;
    };

    // 不存在则插入，否则忽略
    async insertIfNeed (tableName, filters, items, schema) {
        if (!tableName || !filters || !items || !Object.keys(items).length) {
            return false;
        }
        if (!Array.isArray(filters)) {
            filters = [filters];
        }
        const result = await this.queryOne('*', tableName, filters);
        if (!result) {
            await this.insert(tableName, items, schema);
        }
        return true;
    };

    // 执行事务
    async beginTransaction (taskCoreFn, onError) {
        const connection = await this.createConnection();
        // 开始事务
        await connection.query('START TRANSACTION');
        let flag = false;
        try {
            // 执行具体内容
            flag = await taskCoreFn(connection, {
                sqlBuilder: sqlParamsBuilder
            });
        }
        catch (e) {
            onError && onError(e);
        }
        if (flag === false) {
            // 回滚事务操作
            await connection.query('ROLLBACK');
        }
        else if (flag === true) {
            // 提交应用事务
            await connection.query('COMMIT');
        }
        connection.release();
        return flag === true;
    };
}

// static tools
OMysql.sqlBuilder = sqlParamsBuilder;

module.exports = OMysql;
