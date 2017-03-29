import { observable, computed, action } from 'mobx';
import {
    isArray,
    map,
    filter,
    find,
    keyBy,
    forIn,
    at,
    isPlainObject,
} from 'lodash';

const AVAILABLE_CONST_OPTIONS = ['relations', 'limit'];

export default class Store {
    // Holds all models
    @observable models = [];
    // Holds the fetch parameters
    @observable params = {};
    @observable __pendingRequestCount = 0;
    @observable __state = {
        currentPage: 1,
        limit: 25,
        totalRecords: 0,
    };
    __activeRelations = [];
    Model = null;
    api = null;
    __repository;
    __nestedRepository = {};

    @computed get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    @computed get length() {
        return this.models.length;
    }

    constructor(options = {}) {
        if (!isPlainObject(options)) {
            throw Error(
                'Store only accepts an object with options. Chain `.parse(data)` to add models.'
            );
        }
        forIn(options, (value, option) => {
            if (!AVAILABLE_CONST_OPTIONS.includes(option)) {
                throw Error(`Unknown option passed to store: ${option}`);
            }
        });
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (options.limit !== undefined) {
            this.setLimit(options.limit);
        }
    }

    __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
    }

    __addFromRepository(ids = []) {
        ids = isArray(ids) ? ids : [ids];

        const records = at(
            keyBy(this.__repository, this.Model.primaryKey),
            ids
        );
        this.models.replace(
            records.map(record => {
                return new this.Model(record, {
                    store: this,
                    relations: this.__activeRelations,
                });
            })
        );
    }

    __getApi() {
        if (!this.api) {
            throw new Error(
                'You are trying to perform a API request without an `api` property defined on the store.'
            );
        }
        if (!this.url) {
            throw new Error(
                'You are trying to perform a API request without an `url` property defined on the store.'
            );
        }
        return this.api;
    }

    @action fromBackend({ data, repos, relMapping }) {
        this.models.replace(
            data.map(record => {
                // TODO: I'm not happy at all about how this looks.
                // We'll need to finetune some things, but hey, for now it works.
                const model = this._newModel();
                model.fromBackend({
                    data: record,
                    repos,
                    relMapping,
                });
                return model;
            })
        );
    }

    _newModel(model = null) {
        return new this.Model(model, {
            store: this,
            relations: this.__activeRelations,
        });
    }

    @action parse(models) {
        if (!isArray(models)) {
            throw new Error('Parameter supplied to parse() is not an array.');
        }
        this.models.replace(models.map(this._newModel.bind(this)));

        return this;
    }

    @action add(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        const modelInstances = models.map(this._newModel.bind(this));

        modelInstances.forEach(modelInstance => {
            const primaryValue = modelInstance[this.Model.primaryKey];
            if (primaryValue && this.get(primaryValue)) {
                throw Error(
                    `A model with the same primary key value "${primaryValue}" already exists in this store.`
                );
            }
            this.models.push(modelInstance);
        });

        return singular ? modelInstances[0] : modelInstances;
    }

    @action remove(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        models.forEach(model => this.models.remove(model));

        return models;
    }

    @action clear() {
        this.models.clear();
    }

    @action fetch(options = {}) {
        this.__pendingRequestCount += 1;
        const data = Object.assign(
            this.__getApi().buildFetchStoreParams(this),
            this.params,
            options.data
        );
        return this.__getApi().fetchStore({ url: this.url, data }).then(
            action(res => {
                this.__pendingRequestCount -= 1;
                this.__state.totalRecords = res.totalRecords;
                this.fromBackend(res);
            })
        );
    }

    toJS() {
        return this.models.map(model => model.toJS());
    }

    // Methods for pagination.

    getPageOffset() {
        return (this.__state.currentPage - 1) * this.__state.limit;
    }

    @action setLimit(limit) {
        if (limit && !Number.isInteger(limit)) {
            throw new Error('Page limit should be a number or falsy value.');
        }
        this.__state.limit = limit || null;
    }

    @computed get totalPages() {
        if (!this.__state.limit) {
            return 0;
        }
        return Math.ceil(this.__state.totalRecords / this.__state.limit);
    }

    @computed get currentPage() {
        return this.__state.currentPage;
    }

    @computed get hasNextPage() {
        return this.__state.currentPage + 1 <= this.totalPages;
    }

    @computed get hasPreviousPage() {
        return this.__state.currentPage > 1;
    }

    @action getNextPage() {
        if (!this.hasNextPage) {
            throw new Error('There is no next page.');
        }
        this.__state.currentPage += 1;
        return this.fetch();
    }

    @action getPreviousPage() {
        if (!this.hasPreviousPage) {
            throw new Error('There is no previous page.');
        }
        this.__state.currentPage -= 1;
        return this.fetch();
    }

    @action setPage(page = 1, options = {}) {
        if (!Number.isInteger(page)) {
            throw new Error('Page should be a number.');
        }
        if (page > this.totalPages || page < 1) {
            throw new Error(`Page should be between 1 and ${this.totalPages}.`);
        }
        this.__state.currentPage = page;
        if (options.fetch === undefined || options.fetch) {
            return this.fetch();
        }
        return Promise.resolve();
    }

    toBackendAll(newIds = []) {
        const modelData = this.models.map((model, i) => {
            return model.toBackendAll(
                newIds && newIds[i] !== undefined ? newIds[i] : null
            );
        });

        let data = [];
        const relations = {};

        modelData.forEach(model => {
            data = data.concat(model.data);
            forIn(model.relations, (relModel, key) => {
                relations[key] = relations[key]
                    ? relations[key].concat(relModel)
                    : relModel;
            });
        });

        return { data, relations };
    }

    // Helper methods to read models.

    get(id) {
        // The id can be defined as a string or int, but we want it to work in both cases.
        return this.models.find(
            model => model[model.constructor.primaryKey] == id // eslint-disable-line eqeqeq
        );
    }

    map(predicate) {
        return map(this.models, predicate);
    }

    mapByPrimaryKey() {
        return this.map(this.Model.primaryKey);
    }

    filter(predicate) {
        return filter(this.models, predicate);
    }

    find(predicate) {
        return find(this.models, predicate);
    }

    each(predicate) {
        return this.models.forEach(predicate);
    }

    at(index) {
        const zeroLength = this.length - 1;
        if (index > zeroLength) {
            throw new Error(
                `Index ${index} is out of bounds (max ${zeroLength}).`
            );
        }
        if (index < 0) {
            index += this.length;
        }
        return this.models[index];
    }
}
