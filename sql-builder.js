'use strict';

const utils = require('./utils');

/**
 * Generate query filters.
 * @param  {Array} filters
 * [
 *    Object => {key: 'id', desc: {rule: '=/</>/<=/>=/!=/like/not like/between/in/not in', params: String|Array => [对应值]}, rel: 'AND/OR'},
 *    Object => {type: 'group', filters: [xxx], rel: 'AND/OR'},
 *    Object => {key1: xxx, key2: xxx}
 * ]
 * @return {[type]}         [description]
 */
const buildQueryFilter = (filters) => {
    let queryStr = [];
    let params = [];
    let pDesc;
    let pKey;
    let pRel;
    let paramItemStr = '';
    let itemParam;
    filters.forEach((paramItem, idx) => {
        paramItem = Object.assign({}, paramItem);
        pRel = paramItem.rel;
        // 组合
        if (paramItem.type === 'group') {
            const { queryStr: childQueryStr, params: childParams } = buildQueryFilter(paramItem.filters || []);
            queryStr.push(
                idx === 0 ? childQueryStr : `${pRel || 'AND'} (${childQueryStr})`
            );
            params = params.concat(childParams);
        }
        // 扩展
        else if (paramItem.hasOwnProperty('desc')) {
            if (!paramItem.key) {
                return;
            }
            const descType = typeof paramItem.desc;
            if (descType === 'string' || descType === 'number') {
                paramItem.desc = { params: [paramItem.desc] };
            }
            else {
                paramItem.desc = Object.assign({}, paramItem.desc);
                if (!Array.isArray(paramItem.desc.params)) {
                    paramItem.desc.params = [paramItem.desc.params];
                }
            }
            // {rule: '=/</>/<=/>=/BETWEEN/IN', params: Array => [对应值]}
            pDesc = paramItem.desc;
            // id
            pKey = paramItem.key;
            pDesc.rule = pDesc.rule ? pDesc.rule.toUpperCase() : '=';
            pRel = pRel ? pRel.toUpperCase() : 'AND';
            itemParam = pDesc.params.slice(0);
            switch (pDesc.rule) {
                case 'BETWEEN':
                    paramItemStr = `${utils.wrapKey(pKey)} BETWEEN ? AND ?`;
                    if (itemParam.length !== 2) {
                        return;
                    }
                    break;
                case 'IN':
                    if (!Array.isArray(itemParam)) {
                        itemParam = [itemParam];
                    }
                    paramItemStr = `${utils.wrapKey(pKey)} ${pDesc.rule} (${(new Array(itemParam.length)).fill('?').join(',')})`;
                    break;
                case 'NOT IN':
                    if (!Array.isArray(itemParam)) {
                        itemParam = [itemParam];
                    }
                    paramItemStr = `NOT ${utils.wrapKey(pKey)} IN (${(new Array(itemParam.length)).fill('?').join(',')})`;
                    break;
                default:
                    if (itemParam.length !== 1) {
                        return;
                    }
                    paramItemStr = `${utils.wrapKey(pKey)} ${pDesc.rule} ?`;
            }
            queryStr.push(
                idx === 0 ? paramItemStr : `${pRel} ${paramItemStr}`
            );
            params = params.concat(itemParam);
        }
        // 纯key-val使用
        else {
            let fCount = 0;
            for (let key in paramItem) {
                let pType;
                if (paramItem.hasOwnProperty(key)) {
                    pType = typeof paramItem[key];
                    if (pType === 'string' || pType === 'number') {
                        queryStr.push(
                            (fCount === 0) ? `${utils.wrapKey(key)} = ?` : `AND ${utils.wrapKey(key)} = ?`
                        );
                        params = params.concat(paramItem[key]);
                        fCount++;
                    }
                }
            }
        }
    });
    return {
        queryStr: queryStr.join(' '),
        params
    };
};

// Generate query string and paramenters.
const sqlParamsBuilder = {
    query (items, tableName, filters, extra) {
        if (!items || !tableName || !filters) {
            return false;
        }
        if (!Array.isArray(items)) {
            items = [items];
        }
        if (!Array.isArray(filters)) {
            filters = [filters];
        }
        let { queryStr, params } = buildQueryFilter(filters);
        if (!queryStr) {
            return false;
        }
        let sqlStr = `SELECT ${utils.fixKeys(items).join(',')} from ${utils.wrapKey(tableName)} WHERE ${queryStr} ${extra || ''}`;
        return {
            sqlStr,
            params
        };
    },
    queryAll (items, tableName, extra) {
        if (!items || !tableName) {
            return false;
        }
        if (!Array.isArray(items)) {
            items = [items];
        }
        let sqlStr = `SELECT ${utils.fixKeys(items).join(',')} from ${utils.wrapKey(tableName)} ${extra || ''}`;
        return {
            sqlStr,
            params: []
        };
    },
    queryOne (tableName, filters) {
        if (!tableName || !filters) {
            return false;
        }
        if (!Array.isArray(filters)) {
            filters = [filters];
        }
        let { queryStr, params } = buildQueryFilter(filters);
        if (!queryStr) {
            return false;
        }
        let sqlStr = `SELECT * from ${utils.wrapKey(tableName)} WHERE ${queryStr} LIMIT 1`;
        return {
            sqlStr,
            params
        };
    },
    del (tableName, filters) {
        if (!tableName || !filters) {
            return false;
        }
        if (!Array.isArray(filters)) {
            filters = [filters];
        }
        let sqlStr = `DELETE from ${utils.wrapKey(tableName)}`;
        let { queryStr, params } = buildQueryFilter(filters);
        if (!queryStr) {
            return false;
        }
        sqlStr += ` WHERE ${queryStr}`;
        return {
            sqlStr,
            params
        };
    },
    insert (tableName, items, schema) {
        items = utils.resolveItems(items, schema, 'insert');
        if (!tableName || !items || !Object.keys(items).length) {
            return false;
        }
        let { names, values, placeholders } = utils.splitItemsToGroup(items);
        let sqlStr = `INSERT INTO ${utils.wrapKey(tableName)}(${utils.fixKeys(names).join(', ')}) VALUES (${placeholders.join(', ')})`;
        return {
            sqlStr,
            params: values
        };
    },
    /**
     * Batch insert.
     * @param  {String} tableName     table name
     * @param  {Array}  [keys=[]]     The keys name to insert.
     * @param  {Array}  [itemList=[]] The values list，One-to-one correspondence with "keys"
     * @param  {[type]} schema        [description]
     * @return {[type]}               [description]
     */
    insertBatch (tableName, keys = [], itemList = [], schema = {}) {
        const originKeyL = keys.length;
        if (!tableName || !itemList.length || !originKeyL) {
            return false;
        }
        keys = keys.slice(0);
        let keyMap = {};
        keys.forEach(key => {
            keyMap[key] = true;
        });
        let extraVal = [];
        for (let key in schema) {
            if (schema.hasOwnProperty(key)) {
                // 赋给默认值
                if (schema[key].createDef && !keyMap[key]) {
                    extraVal.push(schema[key].createDef());
                    keys.push(key);
                    keyMap[key] = true;
                }
            }
        }
        let params = [];
        let placeholders = [];
        let placeholderStr = (',?').repeat(keys.length).slice(1);
        itemList.forEach(item => {
            if (item.length === originKeyL) {
                placeholders.push(`(${placeholderStr})`);
                params = params.concat(item.concat(extraVal));
            }
        });
        if (!params.length) {
            return false;
        }
        let sqlStr = `INSERT INTO ${utils.wrapKey(tableName)} (${utils.fixKeys(keys).join(',')}) VALUES${placeholders.join(',')}`;
        return {
            sqlStr,
            params
        };
    },
    update (tableName, filters, items, schema) {
        items = utils.resolveItems(items, schema, 'update');
        if (!tableName || !filters || !items || !Object.keys(items).length) {
            return false;
        }
        if (!Array.isArray(filters)) {
            filters = [filters];
        }
        let setSql = [];
        let itemsParams = [];
        for (let i in items) {
            if (items.hasOwnProperty(i)) {
                itemsParams.push(items[i]);
                setSql.push(
                    `${utils.wrapKey(i)} = ?`
                );
            }
        }
        let sqlStr = `UPDATE ${utils.wrapKey(tableName)} SET ${setSql.join(', ')}`;
        let { queryStr, params } = buildQueryFilter(filters);
        if (queryStr) {
            sqlStr += ` WHERE ${queryStr}`;
        }
        return {
            sqlStr,
            params: itemsParams.concat(params)
        };
    },
    // 创建翻页的limit语句，page 从0开始
    limit (page, count, orderByKey, order = 'ASC') {
        page = parseInt(page, 10) || 0;
        count = parseInt(count, 10) || 40;
        let sql = `LIMIT ${page * count},${count}`;
        if (orderByKey) {
            sql = `ORDER BY ${utils.wrapKey(orderByKey)} ${order} ${sql}`;
        }
        return { sqlStr: sql };
    }
};

module.exports = sqlParamsBuilder;
