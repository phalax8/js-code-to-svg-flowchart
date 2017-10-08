import * as babylon from 'babylon';
import { mergeObjectStructures } from 'shared/utils/composition';

import { TOKEN_KEYS } from 'shared/constants';
import { setupPointer } from 'shared/utils/treeLevelsPointer';
import defaultAstConfig from './astParserConfig';

export const parseCodeToAST = (code, config = {}) => {
    return babylon.parse(code, mergeObjectStructures(defaultAstConfig, config));
};

export const buildVisitor = ({ definitionsMap, globalIgnore }, treeNodesDestination) => {
    const pointer = setupPointer(treeNodesDestination),
        wrapByGlobalIgnore = visit => path => visit(path, globalIgnore);

    return definitionsMap.reduce((acc, item) => {
        if (!item.body) {
            acc[item.type] = item.reversed
                ? { exit: wrapByGlobalIgnore(visitSimpleEntry(item, pointer)) }
                : wrapByGlobalIgnore(visitSimpleEntry(item, pointer));
        } else {
            acc[item.type] = {
                enter: wrapByGlobalIgnore(enterComplexEntry(item, pointer)),
                exit: wrapByGlobalIgnore(exitComplexEntry(item, pointer))
            };
        }

        return acc;
    }, {});
};

//TODO: refactor, looks a bit duplicated
const visitSimpleEntry = (item, pointer) => (path, globalIgnore) => {
    if (item.ignore && item.ignore(path)) return;

    const entryConfig = {
        ...getBasicEntryConfig(item, path),
        key: getStatementParentKey(path)
    };

    if (globalIgnore && globalIgnore(entryConfig)) return;

    pushEntry(pointer, entryConfig);
};

const enterComplexEntry = (item, pointer) => (path, globalIgnore) => {
    if (item.ignore && item.ignore(path)) return;

    const entryConfig = pushComplexEntry(item, pointer, path, globalIgnore);

    pointer.stepIn(entryConfig);
};

const pushComplexEntry = (item, pointer, path, globalIgnore) => {
    const entryConfig = {
        ...getBasicEntryConfig(item, path),
        key: getStatementParentKey(path),
        body: []
    };

    if (!(globalIgnore && globalIgnore(entryConfig))) {
        pushEntry(pointer, entryConfig);
    }

    return entryConfig;
};

const pushEntry = (pointer, entry) => {
    const parent = pointer.getCurrent();
    entry.parent = parent;

    (parent.body || parent).push(entry);
};

const getStatementParentKey = path => {
    const statementParent =
        path.find(path => path.parentKey === TOKEN_KEYS.PROGRAM || path.isStatementOrBlock()) || {};
    return statementParent.key;
};

const exitComplexEntry = (item, pointer) => path => {
    if (item.ignore && item.ignore(path)) return;

    pointer.stepOut();
};

const getBasicEntryConfig = (item, path) => {
    const name = item.getName(path),
        nameOptions = typeof name === 'string' ? { name } : name;

    const config = {
        ...nameOptions,
        type: item.type
    };

    if (item.type !== path.node.type) {
        config.subType = path.node.type;
    }

    return config;
};
