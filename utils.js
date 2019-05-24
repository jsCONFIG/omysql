'use strict';

// Parse the final change value according to the schema description
const resolveItems = (items = {}, schema, action = 'update') => {
    if (!schema || !items || !Object.keys(items).length) {
        return items;
    }
    let resolvedItems = Object.assign({}, items);
    if (action === 'update') {
        for (let key in schema) {
            if (schema.hasOwnProperty(key)) {
                // 校验冻结值
                if (schema[key].frozen) {
                    delete resolvedItems[key];
                    continue;
                }
                // 赋给默认值
                if (schema[key].createDef && !resolvedItems.hasOwnProperty(key)) {
                    resolvedItems[key] = schema[key].createDef();
                }
            }
        }
    }
    else if (action === 'insert') {
        for (let key in schema) {
            if (schema.hasOwnProperty(key)) {
                // 赋给默认值
                if (schema[key].createDef && !resolvedItems.hasOwnProperty(key)) {
                    resolvedItems[key] = schema[key].createDef();
                }
            }
        }
    }
    return resolvedItems;
};

// Divide the change item by name and value
const splitItemsToGroup = (items) => {
    let names = [];
    let values = [];
    let placeholders = [];
    for (let key in items) {
        if (items.hasOwnProperty(key)) {
            names.push(key);
            values.push(items[key]);
            placeholders.push('?');
        }
    }
    return {
        names,
        values,
        placeholders
    };
};

module.exports = {
    resolveItems,
    splitItemsToGroup
};
