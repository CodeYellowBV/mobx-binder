import {
    observable,
    isObservableProp,
    extendObservable,
    isObservableArray,
    isObservableObject,
    computed,
    action,
    toJS,
} from 'mobx';
import {
    each,
    forIn,
    mapValues,
    find,
    filter,
    get,
    isPlainObject,
    isArray,
    omit,
    uniqueId,
    uniq,
    uniqBy,
    mapKeys,
    result,
    pick,
} from 'lodash';
import Store from './Store';
import { invariant, snakeToCamel, camelToSnake, relationsToNestedKeys, forNestedRelations } from './utils';

function concatInDict(dict, key, value) {
    dict[key] = dict[key] ? dict[key].concat(value) : value;
}

// Find the relation name before the first dot, and include all other relations after it
// Example: input `animal.kind.breed` output -> `['animal', 'kind.breed']`
const RE_SPLIT_FIRST_RELATION = /([^.]+)\.(.+)/;

// TODO: find a way to get a list of existing properties automatically.
const FORBIDDEN_ATTRS = [
    'url',
    'urlRoot',
    'api',
    'isNew',
    'isLoading',
    'parse',
    'save',
    'clear',
];

export default class Model {
    static primaryKey = 'id';
    // How the model is known at the backend. This is useful when the model is in a relation that has a different name.
    static backendResourceName = '';

    static fileFields = [];
    static pickFields = undefined;
    static omitFields = [];

    urlRoot() {
        // Try to auto-generate the URL.
        const bname = this.constructor.backendResourceName;
        if (bname) {
            return `/${bname}/`;
        }
        return null;
    }

    __attributes = [];
    // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).
    __originalAttributes = {};
    // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)
    __activeRelations = [];
    // Holds activated - non-nested - relations (e.g. `['animal']`)
    __activeCurrentRelations = [];
    __repository;
    __store;
    api = null;
    // A `cid` can be used to identify the model locally.
    cid = `m${uniqueId()}`;
    @observable __backendValidationErrors = {};
    @observable __pendingRequestCount = 0;
    // URL query params that are added to fetch requests.
    @observable __fetchParams = {};
    // Holds fields (attrs+relations) that have been changed via setInput()
    @observable __changes = [];

    // File state
    @observable __fileChanges = {};
    @observable __fileDeletions = {};
    @observable __fileExists = {};

    wrapPendingRequestCount(promise) {
        this.__pendingRequestCount++;

        return promise
            .then((res) => {
                this.__pendingRequestCount--;
                return res;
            })
            .catch((err) => {
                this.__pendingRequestCount--;
                throw err;
            });
    }

    // Useful to reference to this model in a relation - that is not yet saved to the backend.
    getNegativeId() {
        return -parseInt(this.cid.replace('m', ''));
    }

    getInternalId() {
        if (this.isNew) {
            return this.getNegativeId();
        }
        return this[this.constructor.primaryKey];
    }

    @computed
    get url() {
        const id = this[this.constructor.primaryKey];
        return `${result(this, 'urlRoot')}${id ? `${id}/` : ''}`;
    }

    getEncodedFile(file){
        // get the resource name from path
        const id = this[this.constructor.primaryKey];

        if(this.fileFields().includes(file) && id){
            return `${result(this, 'urlRoot')}${id ? `${id}/` : ''}${file}/?encode=true`;
        }
        return '';
    }

    @computed
    get isNew() {
        return !this[this.constructor.primaryKey];
    }

    @computed
    get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    set primaryKey(v) {
        invariant(
            false,
            '`primaryKey` should be a static property on the model.'
        );
    }

    set backendResourceName(v) {
        invariant(
            false,
            '`backendResourceName` should be a static property on the model.'
        );
    }

    casts() {
        return {};
    }

    fileFields() {
        return this.constructor.fileFields;
    }

    pickFields() {
        return this.constructor.pickFields;
    }

    omitFields() {
        return this.constructor.omitFields;
    }

    // Empty function, but can be overridden if you want to do something after initializing the model.
    initialize() {}

    constructor(data, options = {}) {
        this.__store = options.store;
        this.__repository = options.repository;
        // Find all attributes. Not all observables are an attribute.
        forIn(this, (value, key) => {
            if (!key.startsWith('__') && isObservableProp(this, key)) {
                invariant(
                    !FORBIDDEN_ATTRS.includes(key),
                    `Forbidden attribute key used: \`${key}\``
                );
                this.__attributes.push(key);
                let newValue = value;
                // An array or object observable can be mutated, so we want to ensure we always have
                // the original not-yet-mutated object/array.
                if (isObservableArray(value)) {
                    newValue = value.slice();
                } else if (isObservableObject(value)) {
                    newValue = Object.assign({}, value);
                }
                this.__originalAttributes[key] = newValue;
            }
        });
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (data) {
            this.parse(data);
        }
        this.initialize();

        this.saveFile = this.saveFile.bind(this);
    }

    @action
    __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
        // TODO: No idea why getting the relations only works when it's a Function.
        const relations = this.relations && this.relations();
        const relModels = {};
        activeRelations.forEach(aRel => {
            // If aRel is null, this relation is already defined by another aRel
            // IE.: town.restaurants.chef && town
            if (aRel === null) {
                return;
            }
            const relNames = aRel.match(RE_SPLIT_FIRST_RELATION);

            const currentRel = relNames ? relNames[1] : aRel;
            const otherRelNames = relNames && relNames[2];
            const currentProp = relModels[currentRel];
            const otherRels = otherRelNames && [otherRelNames];

            // When two nested relations are defined next to each other (e.g. `['kind.breed', 'kind.location']`),
            // the relation `kind` only needs to be initialized once.
            relModels[currentRel] = currentProp
                ? currentProp.concat(otherRels)
                : otherRels;
            invariant(
                !this.__attributes.includes(currentRel),
                `Cannot define \`${currentRel}\` as both an attribute and a relation. You probably need to remove the attribute.`
            );
            if (!this.__activeCurrentRelations.includes(currentRel)) {
                this.__activeCurrentRelations.push(currentRel);
            }
        });
        extendObservable(
            this,
            mapValues(relModels, (otherRelNames, relName) => {
                const RelModel = relations[relName];
                invariant(
                    RelModel,
                    `Specified relation "${relName}" does not exist on model.`
                );
                const options = { relations: otherRelNames };
                if (RelModel.prototype instanceof Store) {
                    return new RelModel(options);
                }
                return new RelModel(null, options);
            })
        );
    }

    // Many backends use snake_case for attribute names, so we convert to snake_case by default.
    static toBackendAttrKey(attrKey) {
        return camelToSnake(attrKey);
    }

    // In the frontend we don't want to deal with those snake_case attr names.
    static fromBackendAttrKey(attrKey) {
        return snakeToCamel(attrKey);
    }

    @computed
    get hasUserChanges() {
        if (this.__changes.length > 0) {
            return true;
        }
        return this.__activeCurrentRelations.some(rel => {
            return this[rel].hasUserChanges;
        });
    }

    clearUserFieldChanges() {
        this.__changes.clear();
    }

    clearUserFileChanges() {
        this.__fileChanges = {};
        this.__fileDeletions = {};
        this.__fileExists = {};
    }

    clearUserChanges() {
        this.clearUserFieldChanges();
        this.clearUserFileChanges();
    }

    @computed get fieldFilter() {
        const pickFields = this.pickFields();
        const omitFields = this.omitFields();

        return (name) => (
            (!pickFields || pickFields.includes(name)) &&
            !omitFields.includes(name)
        );
    }

    toBackend({ data = {}, mapData = (x) => x, ...options } = {}) {
        const output = {};
        // By default we'll include all fields (attributes+relations), but sometimes you might want to specify the fields to be included.
        const fieldFilter = field => {
            if (!this.fieldFilter(field)) {
                return false;
            }
            if (options.fields) {
                return options.fields.includes(field);
            }
            if (!this.isNew && options.onlyChanges) {
                const forceFields = options.forceFields || [];
                return (
                    forceFields.includes(field) ||
                        this.__changes.includes(field) ||
                        (this[field] instanceof Store && this[field].hasSetChanges) ||
                        // isNew is always true for relations that haven't been saved.
                        // If no property has been tweaked, its id serializes as null.
                        // So, we need to skip saving the id if new and no changes.
                        (this[field] instanceof Model && this[field].isNew && this[field].hasUserChanges)
                );
            }
            return true;
        };
        this.__attributes.filter(fieldFilter).forEach(attr => {
            if (!attr.startsWith('_')) {
                output[
                    this.constructor.toBackendAttrKey(attr)
                ] = this.__toJSAttr(attr, this[attr]);
            }
        });

        // Primary key is always forced to be included.
        output[this.constructor.primaryKey] = this[this.constructor.primaryKey];

        // Add active relations as id.
        this.__activeCurrentRelations
            .filter(fieldFilter)
            .forEach(currentRel => {
                const rel = this[currentRel];
                const relBackendName = this.constructor.toBackendAttrKey(
                    currentRel
                );
                if (rel instanceof Model) {
                    output[relBackendName] = rel[rel.constructor.primaryKey];
                }
                if (rel instanceof Store) {
                    output[relBackendName] = rel.mapByPrimaryKey();
                }
            });

        Object.assign(output, data);
        return mapData(output);
    }

    toBackendAll(options = {}) {
        const nestedRelations = options.nestedRelations || {};
        const data = this.toBackend({
            data: options.data,
            mapData: options.mapData,
            onlyChanges: options.onlyChanges,
        });

        if (data[this.constructor.primaryKey] === null) {
            data[this.constructor.primaryKey] = this.getNegativeId();
        }

        const relations = {};

        this.__activeCurrentRelations.forEach(currentRel => {
            const rel = this[currentRel];
            const relBackendName = this.constructor.toBackendAttrKey(currentRel);
            const subRelations = nestedRelations[currentRel];

            if (subRelations !== undefined) {
                if (data[relBackendName] === null) {
                    data[relBackendName] = rel.getNegativeId();
                } else if (isArray(data[relBackendName])) {
                    data[relBackendName] = uniq(data[relBackendName].map(
                        (pk, i) =>
                            pk === null ? rel.at(i).getNegativeId() : pk
                    ));
                } else if (options.onlyChanges && !rel.hasUserChanges) {
                    return;
                }

                const relBackendData = rel.toBackendAll({
                    nestedRelations: subRelations,
                    onlyChanges: options.onlyChanges,
                });


                // Sometimes the backend knows the relation by a different name, e.g. the relation is called
                // `activities`, but the name in the backend is `activity`.
                // In that case, you can add `static backendResourceName = 'activity';` to that model.
                const realBackendName = rel.constructor.backendResourceName || relBackendName;

                if (relBackendData.data.length > 0) {
                    concatInDict(relations, realBackendName, relBackendData.data);

                    // De-duplicate relations based on `primaryKey`.
                    // TODO: Avoid serializing recursively multiple times in the first place?
                    // TODO: What if different relations have different "freshness"?
                    relations[realBackendName] = uniqBy(
                        relations[realBackendName],
                        rel.constructor.primaryKey || rel.Model.primaryKey
                    );
                }

                // There could still be changes in nested relations,
                // include those anyway!
                forIn(relBackendData.relations, (relB, key) => {
                    concatInDict(relations, key, relB);
                });
            }
        });

        return { data: [data], relations };
    }

    toJS() {
        const output = {};
        this.__attributes.forEach(attr => {
            output[attr] = this.__toJSAttr(attr, this[attr]);
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            const model = this[currentRel];
            if (model) {
                output[currentRel] = model.toJS();
            }
        });
        return output;
    }

    __toJSAttr(attr, value) {
        const casts = this.casts();
        const cast = casts[attr];
        if (cast !== undefined) {
            return toJS(cast.toJS(attr, value));
        }
        return toJS(value);
    }

    setFetchParams(params) {
        this.__fetchParams = Object.assign({}, params);
    }

    __parseRepositoryToData(key, repository) {
        if (isArray(key)) {
            return filter(repository, m => key.includes(m.id));
        }
        return find(repository, { id: key });
    }

    __parseReverseRepositoryToData(reverseKeyName, key, repository) {
        const searchKey = {};
        searchKey[reverseKeyName] = key;
        return filter(repository, searchKey);
    }

    /**
     * We handle the fromBackend recursively.
     * But when recursing, we don't send the full repository, we need to only send the repo
     * relevant to the relation.
     *
     * So when we have a customer with a town.restaurants relation,
     * we get a "town.restaurants": "restaurant", relMapping from Binder
     *
     * Here we create a scoped repository.
     * The root gets a `town.restaurants` repo, but the `town` relation only gets the `restaurants` repo
     */
    __scopeBackendResponse({ data, targetRelName, repos, mapping, reverseMapping }) {
        let scopedData = null;
        let relevant = false;
        const scopedRepos = {};
        const scopedRelMapping = {};
        const scopedReverseRelMapping = {};

        if (!data) {
            return null;
        }

        forIn(mapping, (repoName, backendRelName) => {
            const repository = repos[repoName];
            // For backwards compatibility, reverseMapping is optional (for now)
            const reverseRelName = reverseMapping ? reverseMapping[backendRelName] : null;
            const relName = this.constructor.fromBackendAttrKey(backendRelName);

            if (targetRelName === relName) {
                const relKey = data[this.constructor.toBackendAttrKey(relName)];
                if (relKey !== undefined) {
                    relevant = true;
                    scopedData = this.__parseRepositoryToData(relKey, repository);
                } else if (repository && reverseRelName) {
                    const pk = data[this.constructor.primaryKey];
                    relevant = true;
                    scopedData = this.__parseReverseRepositoryToData(reverseRelName, pk, repository);
                    if (this.relations(relName).prototype instanceof Model) {
                        if (scopedData.length === 0) {
                            scopedData = null;
                        } else if (scopedData.length === 1) {
                            scopedData = scopedData[0];
                        } else {
                            throw new Error('multiple models found for related model');
                        }
                    }
                }
                return;
            }

            if (relName.startsWith(`${targetRelName}.`)) {
                // If we have town.restaurants and the targetRel = town
                // we need "restaurants" in the repository
                relevant = true;
                const backendRelNames = backendRelName.match(RE_SPLIT_FIRST_RELATION);
                const scopedBackendRelName = backendRelNames[2];
                scopedRepos[repoName] = repository;
                scopedRelMapping[scopedBackendRelName] = repoName;
                scopedReverseRelMapping[scopedBackendRelName] = reverseMapping ? reverseMapping[backendRelName] : null;
            }
        });

        if (!relevant) {
            return null;
        }

        return { scopedData, scopedRepos, scopedRelMapping, scopedReverseRelMapping };
    }

    // `data` contains properties for the current model.
    // `repos` is an object of "repositories". A repository is
    // e.g. "animal_kind", while the relation name would be "kind".
    // `relMapping` maps relation names to repositories.
    @action
    fromBackend({ data, repos, relMapping, reverseRelMapping, }) {
        // We handle the fromBackend recursively. On each relation of the source model
        // fromBackend gets called as well, but with data scoped for itself
        //
        // So when we have a model with a `town.restaurants.chef` relation,
        // we call fromBackend on the `town` relation.
        each(this.__activeCurrentRelations, relName => {
            const rel = this[relName];
            const resScoped = this.__scopeBackendResponse({
                data,
                targetRelName: relName,
                repos,
                mapping: relMapping,
                reverseMapping: reverseRelMapping,
            });

            // Make sure we don't parse every relation for nothing
            if (!resScoped) {
                return;
            }

            const { scopedData, scopedRepos, scopedRelMapping, scopedReverseRelMapping } = resScoped;
            rel.fromBackend({
                data: scopedData,
                repos: scopedRepos,
                relMapping: scopedRelMapping,
                reverseRelMapping: scopedReverseRelMapping,
            });
        });

        // Now all repositories are set on the relations, start parsing the actual data.
        // `parse()` will recursively fill in all relations.
        if (data) {
            this.parse(data);
        }
    }

    __getApi() {
        invariant(
            this.api,
            'You are trying to perform a API request without an `api` property defined on the model.'
        );
        invariant(
            result(this, 'urlRoot'),
            'You are trying to perform a API request without an `urlRoot` property defined on the model.'
        );
        return this.api;
    }

    @action
    parse(data) {
        invariant(
            isPlainObject(data),
            `Parameter supplied to \`parse()\` is not an object, got: ${JSON.stringify(
                data
            )}`
        );

        forIn(data, (value, key) => {
            const attr = this.constructor.fromBackendAttrKey(key);
            if (this.__attributes.includes(attr)) {
                this[attr] = this.__parseAttr(attr, value);
            } else if (this.__activeCurrentRelations.includes(attr)) {
                // In Binder, a relation property is an `int` or `[int]`, referring to its ID.
                // However, it can also be an object if there are nested relations (non flattened).
                if (isPlainObject(value) || (Array.isArray(value) && value.every(isPlainObject))) {
                    this[attr].parse(value);
                } else if (value === null) {
                    // The relation is cleared.
                    this[attr].clear();
                }
            }
        });

        return this;
    }

    __parseAttr(attr, value) {
        const casts = this.casts();
        const cast = casts[attr];
        if (cast !== undefined) {
            return cast.parse(attr, value);
        }
        return value;
    }
    
    uuidv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
      }

    saveFile(name) {
        const snakeName = camelToSnake(name);

        if (this.__fileChanges[name]) {
            const file = this.__fileChanges[name];

            // debugger;

            const data = new FormData();

            if(this.isBase64(file)){
                const newfile = this.dataURItoBlob(file);
                // file = `${URL.createObjectURL(blob)}`;
                const fname = `${this.uuidv4()}.png`;
                data.append(name, newfile, fname );
            } else{
                data.append(name, file, file.name);
            }

            return (
                this.api.post(
                    `${this.url}${snakeName}/`,
                    data,
                    { headers: { 'Content-Type': 'multipart/form-data' } },
                )
                .then(action((res) => {
                    this.__fileExists[name] = true;
                    delete this.__fileChanges[name];
                    this.saveFromBackend(res);
                }))
            );
        } else if (this.__fileDeletions[name]) {
            if (this.__fileExists[name]) {
                return (
                    this.api.delete(`${this.url}${snakeName}/`)
                    .then(action(() => {
                        this.__fileExists[name] = false;
                        delete this.__fileDeletions[name];
                        this.saveFromBackend({ data: {
                            [snakeName]: null,
                        } });
                    }))
                );
            } else {
                delete this.__fileDeletions[name];
            }
        } else {
            return Promise.resolve();
        }
    }

    saveFiles() {
        return Promise.all(
            this.fileFields()
            .filter(this.fieldFilter)
            .map(this.saveFile)
        );
    }

    @action
    save(options = {}) {
        this.clearValidationErrors();
        return this.wrapPendingRequestCount(
            this.__getApi()
            .saveModel({
                url: options.url || this.url,
                data: this.toBackend({
                        data: options.data,
                        mapData: options.mapData,
                        fields: options.fields,
                        onlyChanges: options.onlyChanges,
                    }),
                isNew: this.isNew,
                requestOptions: omit(options, 'url', 'data', 'mapData')
            })
            .then(action(res => {
                this.saveFromBackend({
                    ...res,
                    data: omit(res.data, this.fileFields().map(camelToSnake)),
                });
                this.clearUserFieldChanges();
                return this.saveFiles().then(() => {
                    this.clearUserFileChanges();
                    return Promise.resolve(res);
                });
            }))
            .catch(
                action(err => {
                    if (err.valErrors) {
                        this.parseValidationErrors(err.valErrors);
                    }
                    throw err;
                })
            )
        );
    }

    isBase64(str) {
        if( typeof str === 'object' || str === undefined || str === null){ return false;}
        if (str ==='' || str.trim() ===''){ return false; }
        str = str.replace(/^[^,]+,/, '');
        try {
            return btoa(atob(str)) === atob(btoa(str));
        } catch (err) {
            return false;
        }
    }

    dataURItoBlob(dataURI) {
        var mime = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var binary = atob(dataURI.split(',')[1]);
        var array = [];
        for (var i = 0; i < binary.length; i++) {
           array.push(binary.charCodeAt(i));
        }
        return new Blob([new Uint8Array(array)], {type: mime});
      }
      
    

    @action
    setInput(name, value) {
        invariant(
            this.__attributes.includes(name) ||
                this.__activeCurrentRelations.includes(name),
            `Field \`${name}\` does not exist on the model.`
        );
        this.isBase64File = false;

        if (this.fileFields().includes(name)) {
            if (this.__fileExists[name] === undefined) {
                this.__fileExists[name] = this[name] !== null;
            }
            if (value) {
                this.__fileChanges[name] = value;
                delete this.__fileDeletions[name];

                // console.log('value!', this.isBase64(value));
                this.isBase64File = this.isBase64(value);    

                if(!this.isBase64File){
                    value = `${URL.createObjectURL(value)}?content_type=${value.type}`;
                }
                else {
                    var blob = this.dataURItoBlob(value);
                    value = `${URL.createObjectURL(blob)}`;
                }
            } else {
                if (!this.__fileChanges[name] || this.__fileChanges[name].existed) {
                    this.__fileDeletions[name] = true;
                }
                delete this.__fileChanges[name];

                value = null;
            }
        }
        if (!this.__changes.includes(name)) {
            this.__changes.push(name);
        }
        if (this.__activeCurrentRelations.includes(name)) {
            if (isArray(value)) {
                this[name].clear();
                this[name].add(value.map(v => v.toJS()));
            } else if (value) {
                this[name].parse(value.toJS());
            } else {
                this[name].clear();
            }
        } else {
            this[name] = value;
        }
        if (this.backendValidationErrors[name]) {
            this.__backendValidationErrors = Object.assign(
                this.backendValidationErrors,
                { [name]: undefined }
            );
        }
    }

    saveAllFiles(relations = {}) {
        const promises = [this.saveFiles()];
        for (const rel of Object.keys(relations)) {
            promises.push(this[rel].saveAllFiles(relations[rel]));
        }
        return Promise.all(promises);
    }

    @action
    saveAll(options = {}) {
        this.clearValidationErrors();
        return this.wrapPendingRequestCount(
            this.__getApi()
            .saveAllModels({
                url: result(this, 'urlRoot'),
                model: this,
                data: this.toBackendAll({
                    data: options.data,
                    mapData: options.mapData,
                    nestedRelations: relationsToNestedKeys(options.relations || []),
                    onlyChanges: options.onlyChanges,
                }),
                requestOptions: omit(options, 'relations', 'data', 'mapData'),
            })
            .then(action(res => {
                this.saveFromBackend(res);
                this.clearUserFieldChanges();

                forNestedRelations(this, relationsToNestedKeys(options.relations || []), relation => {
                    if (relation instanceof Model) {
                        relation.clearUserFieldChanges();
                    } else {
                        relation.clearSetChanges();
                    }
                });

                return this.saveAllFiles(relationsToNestedKeys(options.relations || [])).then(() => {
                    this.clearUserFileChanges();

                    forNestedRelations(this, relationsToNestedKeys(options.relations || []), relation => {
                        if (relation instanceof Model) {
                            relation.clearUserFileChanges();
                        }
                    });

                    return res;
                });
            }))
            .catch(
                action(err => {
                    if (err.valErrors) {
                        this.parseValidationErrors(err.valErrors);
                    }
                    throw err;
                })
            )
        );
    }

    // After saving a model, we should get back an ID mapping from the backend which looks like:
    // `{ "animal": [[-1, 10]] }`
    __parseNewIds(idMaps) {
        const bName = this.constructor.backendResourceName;
        if (bName && idMaps[bName]) {
            const idMap = idMaps[bName].find(
                ids => ids[0] === this.getInternalId()
            );
            if (idMap) {
                this[this.constructor.primaryKey] = idMap[1];
            }
        }
        each(this.__activeCurrentRelations, relName => {
            const rel = this[relName];
            rel.__parseNewIds(idMaps);
        });
    }

    validationErrorFormatter(obj) {
        return obj.code;
    }

    @action
    parseValidationErrors(valErrors) {
        const bname = this.constructor.backendResourceName;

        if (valErrors[bname]) {
            const id = this.getInternalId();
            // When there is no id or negative id, the backend may use the string 'null'. Bit weird, but eh.
            const errorsForModel =
                valErrors[bname][id] || valErrors[bname]['null'];
            if (errorsForModel) {
                const camelCasedErrors = mapKeys(errorsForModel, (value, key) =>
                    snakeToCamel(key)
                );
                const formattedErrors = mapValues(
                    camelCasedErrors,
                    valError => {
                        return valError.map(this.validationErrorFormatter);
                    }
                );
                this.__backendValidationErrors = formattedErrors;
            }
        }

        this.__activeCurrentRelations.forEach(currentRel => {
            this[currentRel].parseValidationErrors(valErrors);
        });
    }

    @action
    clearValidationErrors() {
        this.__backendValidationErrors = {};
        this.__activeCurrentRelations.forEach(currentRel => {
            this[currentRel].clearValidationErrors();
        });
    }

    // This is just a pass-through to make it easier to override parsing backend responses from the backend.
    // Sometimes the backend won't return the model after a save because e.g. it is created async.
    saveFromBackend(res) {
        return this.fromBackend(res);
    }

    // TODO: This is a bit hacky...
    @computed
    get backendValidationErrors() {
        return this.__backendValidationErrors;
    }

    @action
    delete(options = {}) {
        const removeFromStore = () =>
            this.__store ? this.__store.remove(this) : null;
        if (options.immediate || this.isNew) {
            removeFromStore();
        }
        if (this.isNew) {
            return Promise.resolve();
        }

        return this.wrapPendingRequestCount(
            this.__getApi()
            .deleteModel({
                url: options.url || this.url,
                requestOptions: omit(options, ['immediate', 'url']),
            })
            .then(
                action(() => {
                    if (!options.immediate) {
                        removeFromStore();
                    }
                })
            )
        );
    }

    buildFetchData(options) {
        return Object.assign(
            this.__getApi().buildFetchModelParams(this),
            this.__fetchParams,
            options.data
        );
    }

    @action
    fetch(options = {}) {
        invariant(!this.isNew, 'Trying to fetch model without id!');

        const data = this.buildFetchData(options);
        const promise = this.wrapPendingRequestCount(
            this.__getApi()
            .fetchModel({
                url: options.url || this.url,
                data,
                requestOptions: omit(options, ['data', 'url']),
            })
            .then(action(res => {
                this.fromBackend(res);
            }))
        );

        return promise;
    }

    @action
    clear() {
        forIn(this.__originalAttributes, (value, key) => {
            this[key] = value;
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            this[currentRel].clear();
        });
    }
}
