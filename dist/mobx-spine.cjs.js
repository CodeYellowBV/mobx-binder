'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mobx = require('mobx');
var lodash = require('lodash');
var axios = _interopDefault(require('axios'));
var moment = _interopDefault(require('moment'));
var luxon = require('luxon');

function invariant(condition) {
    var message = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Illegal state';

    if (!condition) {
        throw new Error('[mobx-spine] ' + message);
    }
}

// lodash's `snakeCase` method removes dots from the string; this breaks mobx-spine
function camelToSnake(s) {
    return s.replace(/([A-Z])/g, function ($1) {
        return '_' + $1.toLowerCase();
    });
}

// lodash's `camelCase` method removes dots from the string; this breaks mobx-spine
function snakeToCamel(s) {
    if (s.startsWith('_')) {
        return s;
    }
    return s.replace(/_\w/g, function (m) {
        return m[1].toUpperCase();
    });
}

// ['kind.breed', 'owner'] => { 'owner': {}, 'kind': {'breed': {}}}
function relationsToNestedKeys(relations) {
    var nestedRelations = {};

    relations.forEach(function (rel) {
        var current = nestedRelations;
        var components = rel.split('.');
        var len = components.length;

        for (var i = 0; i < len; ++i) {
            var head = components[i];
            if (current[head] === undefined) {
                current[head] = {};
            }
            current = current[head];
        }
    });

    return nestedRelations;
}

// Use output of relationsToNestedKeys to iterate each relation, fn is called on each model and store.
function forNestedRelations(model, nestedRelations, fn) {
    Object.keys(nestedRelations).forEach(function (key) {
        if (Object.keys(nestedRelations[key]).length > 0) {
            if (model[key].forEach) {
                model[key].forEach(function (m) {
                    forNestedRelations(m, nestedRelations[key], fn);
                });

                fn(model);
            } else {
                forNestedRelations(model[key], nestedRelations[key], fn);
            }
        }

        if (model[key].forEach) {
            model[key].forEach(fn);
        }

        fn(model[key]);
    });
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var objectWithoutProperties = function (obj, keys) {
  var target = {};

  for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
    target[i] = obj[i];
  }

  return target;
};

var _class, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _class2, _temp;

function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: descriptor.writable,
        value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
}

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
        Object['define' + 'Property'](target, property, desc);
        desc = null;
    }

    return desc;
}
var AVAILABLE_CONST_OPTIONS = ['relations', 'limit', 'comparator', 'params', 'repository'];

var Store = (_class = (_temp = _class2 = function () {
    createClass(Store, [{
        key: 'url',
        value: function url() {
            // Try to auto-generate the URL.
            var bname = this.constructor.backendResourceName;
            if (bname) {
                return '/' + bname + '/';
            }
            return null;
        }
        // The set of models has changed

        // Holds the fetch parameters

    }, {
        key: 'initialize',


        // Empty function, but can be overridden if you want to do something after initializing the model.
        value: function initialize() {}
    }, {
        key: 'isLoading',
        get: function get$$1() {
            return this.__pendingRequestCount > 0;
        }
    }, {
        key: 'length',
        get: function get$$1() {
            return this.models.length;
        }
    }, {
        key: 'backendResourceName',
        set: function set$$1(v) {
            invariant(false, '`backendResourceName` should be a static property on the store.');
        }
    }]);

    function Store() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        classCallCheck(this, Store);

        _initDefineProp(this, 'models', _descriptor, this);

        _initDefineProp(this, 'params', _descriptor2, this);

        _initDefineProp(this, '__pendingRequestCount', _descriptor3, this);

        _initDefineProp(this, '__setChanged', _descriptor4, this);

        _initDefineProp(this, '__state', _descriptor5, this);

        this.__activeRelations = [];
        this.Model = null;
        this.api = null;

        invariant(lodash.isPlainObject(options), 'Store only accepts an object with options. Chain `.parse(data)` to add models.');
        lodash.forIn(options, function (value, option) {
            invariant(AVAILABLE_CONST_OPTIONS.includes(option), 'Unknown option passed to store: ' + option);
        });
        this.__repository = options.repository;
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (options.limit !== undefined) {
            this.setLimit(options.limit);
        }
        if (options.comparator) {
            this.comparator = options.comparator;
        }
        if (options.params) {
            this.params = options.params;
        }
        this.initialize();
    }

    createClass(Store, [{
        key: '__parseRelations',
        value: function __parseRelations(activeRelations) {
            this.__activeRelations = activeRelations;
        }
    }, {
        key: '__getApi',
        value: function __getApi() {
            invariant(this.api, 'You are trying to perform a API request without an `api` property defined on the store.');
            invariant(lodash.result(this, 'url'), 'You are trying to perform a API request without an `url` property defined on the store.');
            return this.api;
        }
    }, {
        key: 'fromBackend',
        value: function fromBackend(_ref) {
            var _this = this;

            var data = _ref.data,
                repos = _ref.repos,
                relMapping = _ref.relMapping,
                reverseRelMapping = _ref.reverseRelMapping;

            invariant(data, 'Backend error. Data is not set. HINT: DID YOU FORGET THE M2M again?');

            this.models.replace(data.map(function (record) {
                // TODO: I'm not happy at all about how this looks.
                // We'll need to finetune some things, but hey, for now it works.
                var model = _this._newModel();
                model.fromBackend({
                    data: record,
                    repos: repos,
                    relMapping: relMapping,
                    reverseRelMapping: reverseRelMapping
                });
                return model;
            }));
            this.sort();
        }
    }, {
        key: '_newModel',
        value: function _newModel() {
            var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

            return new this.Model(model, {
                store: this,
                relations: this.__activeRelations
            });
        }
    }, {
        key: 'sort',
        value: function sort() {
            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            invariant(lodash.isPlainObject(options), 'Expecting a plain object for options.');
            if (!this.comparator) {
                return this;
            }
            if (typeof this.comparator === 'string') {
                this.models.replace(this.sortBy(this.comparator));
            } else {
                this.models.replace(this.models.slice().sort(this.comparator));
            }
            return this;
        }
    }, {
        key: 'parse',
        value: function parse(models) {
            invariant(lodash.isArray(models), 'Parameter supplied to `parse()` is not an array, got: ' + JSON.stringify(models));
            // Parse does not mutate __setChanged, as it is used in
            // fromBackend in the model...
            this.models.replace(models.map(this._newModel.bind(this)));
            this.sort();

            return this;
        }
    }, {
        key: 'parseValidationErrors',
        value: function parseValidationErrors(valErrors) {
            this.each(function (model) {
                model.parseValidationErrors(valErrors);
            });
        }
    }, {
        key: 'clearValidationErrors',
        value: function clearValidationErrors() {
            this.each(function (model) {
                model.clearValidationErrors();
            });
        }
    }, {
        key: 'add',
        value: function add(models) {
            var _this2 = this;

            var singular = !lodash.isArray(models);
            models = singular ? [models] : models.slice();

            var modelInstances = models.map(this._newModel.bind(this));

            modelInstances.forEach(function (modelInstance) {
                var primaryValue = modelInstance[_this2.Model.primaryKey];
                invariant(!primaryValue || !_this2.get(primaryValue), 'A model with the same primary key value "' + primaryValue + '" already exists in this store.');
                _this2.__setChanged = true;
                _this2.models.push(modelInstance);
            });
            this.sort();

            return singular ? modelInstances[0] : modelInstances;
        }
    }, {
        key: 'remove',
        value: function remove(models) {
            var _this3 = this;

            var singular = !lodash.isArray(models);
            models = singular ? [models] : models.slice();

            models.forEach(function (model) {
                return _this3.models.remove(model);
            });
            if (models.length > 0) {
                this.__setChanged = true;
            }
            return models;
        }
    }, {
        key: 'removeById',
        value: function removeById(ids) {
            var _this4 = this;

            var singular = !lodash.isArray(ids);
            ids = singular ? [ids] : ids.slice();
            invariant(!ids.some(isNaN), 'Cannot remove a model by id that is not a number: ' + JSON.stringify(ids));

            var models = ids.map(function (id) {
                return _this4.get(id);
            });

            models.forEach(function (model) {
                if (model) {
                    _this4.models.remove(model);
                    _this4.__setChanged = true;
                }
            });

            return models;
        }
    }, {
        key: 'clear',
        value: function clear() {
            var length = this.models.length;
            this.models.clear();

            if (length > 0) {
                this.__setChanged = true;
            }
        }
    }, {
        key: 'buildFetchData',
        value: function buildFetchData(options) {
            return Object.assign(this.__getApi().buildFetchStoreParams(this), this.params, options.data);
        }
    }, {
        key: 'fetch',
        value: function fetch() {
            var _this5 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};


            var data = this.buildFetchData(options);
            var promise = this.wrapPendingRequestCount(this.__getApi().fetchStore({
                url: options.url || lodash.result(this, 'url'),
                data: data,
                requestOptions: lodash.omit(options, 'data')
            }).then(mobx.action(function (res) {
                _this5.__state.totalRecords = res.totalRecords;
                _this5.fromBackend(res);

                return res.response;
            })));

            return promise;
        }
    }, {
        key: '__parseNewIds',
        value: function __parseNewIds(idMaps) {
            this.each(function (model) {
                return model.__parseNewIds(idMaps);
            });
        }
    }, {
        key: 'toJS',
        value: function toJS() {
            return this.models.map(function (model) {
                return model.toJS();
            });
        }

        // Methods for pagination.

    }, {
        key: 'getPageOffset',
        value: function getPageOffset() {
            return (this.__state.currentPage - 1) * this.__state.limit;
        }
    }, {
        key: 'setLimit',
        value: function setLimit(limit) {
            invariant(!limit || Number.isInteger(limit), 'Page limit should be a number or falsy value.');
            this.__state.limit = limit || null;
        }
    }, {
        key: 'getNextPage',
        value: function getNextPage() {
            invariant(this.hasNextPage, 'There is no next page.');
            this.__state.currentPage += 1;
            return this.fetch();
        }
    }, {
        key: 'getPreviousPage',
        value: function getPreviousPage() {
            invariant(this.hasPreviousPage, 'There is no previous page.');
            this.__state.currentPage -= 1;
            return this.fetch();
        }
    }, {
        key: 'setPage',
        value: function setPage() {
            var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            invariant(Number.isInteger(page) && page >= 1, 'Page should be a number above 1.');
            this.__state.currentPage = page;
            if (options.fetch === undefined || options.fetch) {
                return this.fetch();
            }
            invariant(
            // Always allow to go to page 1.
            page <= (this.totalPages || 1), 'Page should be between 1 and ' + this.totalPages + '.');
            return Promise.resolve();
        }
    }, {
        key: 'clearSetChanges',
        value: function clearSetChanges() {
            this.__setChanged = false;
        }
    }, {
        key: 'toBackendAll',
        value: function toBackendAll() {
            var _this6 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var relevantModels = options.onlyChanges ? this.models.filter(function (model) {
                return model.isNew || model.hasUserChanges;
            }) : this.models;
            var modelData = relevantModels.map(function (model) {
                return model.toBackendAll(options);
            });

            var data = [];
            var relations = {};

            modelData.forEach(function (model) {
                data = data.concat(model.data);
                lodash.forIn(model.relations, function (relModel, key) {
                    relations[key] = relations[key] ? relations[key].concat(relModel) : relModel;
                    // TODO: this primaryKey is not the primaryKey of the relation we're de-duplicating...
                    relations[key] = lodash.uniqBy(relations[key], _this6.Model.primaryKey);
                });
            });

            return { data: data, relations: relations };
        }

        // Create a new instance of this store with a predicate applied.
        // This new store will be automatically kept in-sync with all models that adhere to the predicate.

    }, {
        key: 'virtualStore',
        value: function virtualStore(_ref2) {
            var _this7 = this;

            var filter = _ref2.filter,
                comparator = _ref2.comparator;

            var store = new this.constructor({
                relations: this.__activeRelations,
                comparator: comparator
            });

            // Oh gawd MobX is so awesome.
            var events = mobx.autorun(function () {
                var models = _this7.filter(filter);
                store.models.replace(models);
                store.sort();

                // When the parent store is busy, make sure the virtual store is
                // also busy.
                store.__pendingRequestCount = _this7.__pendingRequestCount;
            });

            store.unsubscribeVirtualStore = events;

            return store;
        }

        // Helper methods to read models.

    }, {
        key: 'get',
        value: function get$$1(id) {
            // The id can be defined as a string or int, but we want it to work in both cases.
            return this.models.find(function (model) {
                return model[model.constructor.primaryKey] == id;
            } // eslint-disable-line eqeqeq
            );
        }
    }, {
        key: 'getByIds',
        value: function getByIds(ids) {
            return this.models.filter(function (model) {
                var id = model[model.constructor.primaryKey];
                return ids.includes(id) || ids.includes('' + id);
            });
        }
    }, {
        key: 'map',
        value: function map(predicate) {
            return lodash.map(this.models, predicate);
        }
    }, {
        key: 'mapByPrimaryKey',
        value: function mapByPrimaryKey() {
            return this.map(this.Model.primaryKey);
        }
    }, {
        key: 'filter',
        value: function filter(predicate) {
            return lodash.filter(this.models, predicate);
        }
    }, {
        key: 'find',
        value: function find(predicate) {
            return lodash.find(this.models, predicate);
        }
    }, {
        key: 'each',
        value: function each(predicate) {
            return this.models.forEach(predicate);
        }
    }, {
        key: 'forEach',
        value: function forEach(predicate) {
            return this.models.forEach(predicate);
        }
    }, {
        key: 'sortBy',
        value: function sortBy(iteratees) {
            return lodash.sortBy(this.models, iteratees);
        }
    }, {
        key: 'at',
        value: function at(index) {
            var zeroLength = this.length - 1;
            invariant(index <= zeroLength, 'Index ' + index + ' is out of bounds (max ' + zeroLength + ').');
            if (index < 0) {
                index += this.length;
            }
            return this.models[index];
        }
    }, {
        key: 'wrapPendingRequestCount',
        value: function wrapPendingRequestCount(promise) {
            var _this8 = this;

            this.__pendingRequestCount++;

            return promise.then(function (res) {
                _this8.__pendingRequestCount--;
                return res;
            }).catch(function (err) {
                _this8.__pendingRequestCount--;
                throw err;
            });
        }
    }, {
        key: 'saveAllFiles',
        value: function saveAllFiles() {
            var relations = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var promises = [];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = this.models[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var model = _step.value;

                    promises.push(model.saveAllFiles(relations));
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return Promise.all(promises);
        }
    }, {
        key: 'totalPages',
        get: function get$$1() {
            if (!this.__state.limit) {
                return 0;
            }
            return Math.ceil(this.__state.totalRecords / this.__state.limit);
        }
    }, {
        key: 'currentPage',
        get: function get$$1() {
            return this.__state.currentPage;
        }
    }, {
        key: 'hasNextPage',
        get: function get$$1() {
            return this.__state.currentPage + 1 <= this.totalPages;
        }
    }, {
        key: 'hasPreviousPage',
        get: function get$$1() {
            return this.__state.currentPage > 1;
        }
    }, {
        key: 'hasUserChanges',
        get: function get$$1() {
            return this.hasSetChanges || this.models.some(function (m) {
                return m.hasUserChanges;
            });
        }

        // TODO: Maybe we can keep track of what got added and what got
        // removed exactly.  For now this should be enough.

    }, {
        key: 'hasSetChanges',
        get: function get$$1() {
            return this.__setChanged;
        }
    }]);
    return Store;
}(), _class2.backendResourceName = '', _temp), (_descriptor = _applyDecoratedDescriptor(_class.prototype, 'models', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return [];
    }
}), _descriptor2 = _applyDecoratedDescriptor(_class.prototype, 'params', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {};
    }
}), _descriptor3 = _applyDecoratedDescriptor(_class.prototype, '__pendingRequestCount', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return 0;
    }
}), _descriptor4 = _applyDecoratedDescriptor(_class.prototype, '__setChanged', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return false;
    }
}), _descriptor5 = _applyDecoratedDescriptor(_class.prototype, '__state', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {
            currentPage: 1,
            limit: 25,
            totalRecords: 0
        };
    }
}), _applyDecoratedDescriptor(_class.prototype, 'isLoading', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'isLoading'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'length', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'length'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'fromBackend', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'fromBackend'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'sort', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'sort'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'parse', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'parse'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'add', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'add'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'remove', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'remove'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'removeById', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'removeById'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'clear', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'clear'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'fetch', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'fetch'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'setLimit', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'setLimit'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'totalPages', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'totalPages'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'currentPage', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'currentPage'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'hasNextPage', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'hasNextPage'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'hasPreviousPage', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'hasPreviousPage'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'getNextPage', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'getNextPage'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'getPreviousPage', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'getPreviousPage'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'setPage', [mobx.action], Object.getOwnPropertyDescriptor(_class.prototype, 'setPage'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'hasUserChanges', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'hasUserChanges'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'hasSetChanges', [mobx.computed], Object.getOwnPropertyDescriptor(_class.prototype, 'hasSetChanges'), _class.prototype)), _class);

var _class$1, _descriptor$1, _descriptor2$1, _descriptor3$1, _descriptor4$1, _descriptor5$1, _descriptor6, _descriptor7, _class2$1, _temp$1;

function _initDefineProp$1(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: descriptor.writable,
        value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
}

function _applyDecoratedDescriptor$1(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
        Object['define' + 'Property'](target, property, desc);
        desc = null;
    }

    return desc;
}

function concatInDict(dict, key, value) {
    dict[key] = dict[key] ? dict[key].concat(value) : value;
}

// Find the relation name before the first dot, and include all other relations after it
// Example: input `animal.kind.breed` output -> `['animal', 'kind.breed']`
var RE_SPLIT_FIRST_RELATION = /([^.]+)\.(.+)/;

// TODO: find a way to get a list of existing properties automatically.
var FORBIDDEN_ATTRS = ['url', 'urlRoot', 'api', 'isNew', 'isLoading', 'parse', 'save', 'clear'];

var Model = (_class$1 = (_temp$1 = _class2$1 = function () {
    createClass(Model, [{
        key: 'urlRoot',

        // How the model is known at the backend. This is useful when the model is in a relation that has a different name.
        value: function urlRoot() {
            // Try to auto-generate the URL.
            var bname = this.constructor.backendResourceName;
            if (bname) {
                return '/' + bname + '/';
            }
            return null;
        }
        // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).

        // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)

        // Holds activated - non-nested - relations (e.g. `['animal']`)

        // A `cid` can be used to identify the model locally.

        // URL query params that are added to fetch requests.

        // Holds fields (attrs+relations) that have been changed via setInput()


        // File state

    }, {
        key: 'wrapPendingRequestCount',
        value: function wrapPendingRequestCount(promise) {
            var _this = this;

            this.__pendingRequestCount++;

            return promise.then(function (res) {
                _this.__pendingRequestCount--;
                return res;
            }).catch(function (err) {
                _this.__pendingRequestCount--;
                throw err;
            });
        }

        // Useful to reference to this model in a relation - that is not yet saved to the backend.

    }, {
        key: 'getNegativeId',
        value: function getNegativeId() {
            return -parseInt(this.cid.replace('m', ''));
        }
    }, {
        key: 'getInternalId',
        value: function getInternalId() {
            if (this.isNew) {
                return this.getNegativeId();
            }
            return this[this.constructor.primaryKey];
        }
    }, {
        key: 'getEncodedFile',
        value: function getEncodedFile(file) {
            // get the resource name from path
            var id = this[this.constructor.primaryKey];

            if (this.fileFields().includes(file) && id) {
                return '' + lodash.result(this, 'urlRoot') + (id ? id + '/' : '') + file + '/?encode=true';
            }
            return '';
        }
    }, {
        key: 'casts',
        value: function casts() {
            return {};
        }
    }, {
        key: 'fileFields',
        value: function fileFields() {
            return this.constructor.fileFields;
        }
    }, {
        key: 'pickFields',
        value: function pickFields() {
            return this.constructor.pickFields;
        }
    }, {
        key: 'omitFields',
        value: function omitFields() {
            return this.constructor.omitFields;
        }

        // Empty function, but can be overridden if you want to do something after initializing the model.

    }, {
        key: 'initialize',
        value: function initialize() {}
    }, {
        key: 'url',
        get: function get$$1() {
            var id = this[this.constructor.primaryKey];
            return '' + lodash.result(this, 'urlRoot') + (id ? id + '/' : '');
        }
    }, {
        key: 'isNew',
        get: function get$$1() {
            return !this[this.constructor.primaryKey];
        }
    }, {
        key: 'isLoading',
        get: function get$$1() {
            return this.__pendingRequestCount > 0;
        }
    }, {
        key: 'primaryKey',
        set: function set$$1(v) {
            invariant(false, '`primaryKey` should be a static property on the model.');
        }
    }, {
        key: 'backendResourceName',
        set: function set$$1(v) {
            invariant(false, '`backendResourceName` should be a static property on the model.');
        }
    }]);

    function Model(data) {
        var _this2 = this;

        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        classCallCheck(this, Model);
        this.__attributes = [];
        this.__originalAttributes = {};
        this.__activeRelations = [];
        this.__activeCurrentRelations = [];
        this.api = null;
        this.cid = 'm' + lodash.uniqueId();

        _initDefineProp$1(this, '__backendValidationErrors', _descriptor$1, this);

        _initDefineProp$1(this, '__pendingRequestCount', _descriptor2$1, this);

        _initDefineProp$1(this, '__fetchParams', _descriptor3$1, this);

        _initDefineProp$1(this, '__changes', _descriptor4$1, this);

        _initDefineProp$1(this, '__fileChanges', _descriptor5$1, this);

        _initDefineProp$1(this, '__fileDeletions', _descriptor6, this);

        _initDefineProp$1(this, '__fileExists', _descriptor7, this);

        this.__store = options.store;
        this.__repository = options.repository;
        // Find all attributes. Not all observables are an attribute.
        lodash.forIn(this, function (value, key) {
            if (!key.startsWith('__') && mobx.isObservableProp(_this2, key)) {
                invariant(!FORBIDDEN_ATTRS.includes(key), 'Forbidden attribute key used: `' + key + '`');
                _this2.__attributes.push(key);
                var newValue = value;
                // An array or object observable can be mutated, so we want to ensure we always have
                // the original not-yet-mutated object/array.
                if (mobx.isObservableArray(value)) {
                    newValue = value.slice();
                } else if (mobx.isObservableObject(value)) {
                    newValue = Object.assign({}, value);
                }
                _this2.__originalAttributes[key] = newValue;
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

    createClass(Model, [{
        key: '__parseRelations',
        value: function __parseRelations(activeRelations) {
            var _this3 = this;

            this.__activeRelations = activeRelations;
            // TODO: No idea why getting the relations only works when it's a Function.
            var relations = this.relations && this.relations();
            var relModels = {};
            activeRelations.forEach(function (aRel) {
                // If aRel is null, this relation is already defined by another aRel
                // IE.: town.restaurants.chef && town
                if (aRel === null) {
                    return;
                }
                var relNames = aRel.match(RE_SPLIT_FIRST_RELATION);

                var currentRel = relNames ? relNames[1] : aRel;
                var otherRelNames = relNames && relNames[2];
                var currentProp = relModels[currentRel];
                var otherRels = otherRelNames && [otherRelNames];

                // When two nested relations are defined next to each other (e.g. `['kind.breed', 'kind.location']`),
                // the relation `kind` only needs to be initialized once.
                relModels[currentRel] = currentProp ? currentProp.concat(otherRels) : otherRels;
                invariant(!_this3.__attributes.includes(currentRel), 'Cannot define `' + currentRel + '` as both an attribute and a relation. You probably need to remove the attribute.');
                if (!_this3.__activeCurrentRelations.includes(currentRel)) {
                    _this3.__activeCurrentRelations.push(currentRel);
                }
            });
            mobx.extendObservable(this, lodash.mapValues(relModels, function (otherRelNames, relName) {
                var RelModel = relations[relName];
                invariant(RelModel, 'Specified relation "' + relName + '" does not exist on model.');
                var options = { relations: otherRelNames };
                if (RelModel.prototype instanceof Store) {
                    return new RelModel(options);
                }
                return new RelModel(null, options);
            }));
        }

        // Many backends use snake_case for attribute names, so we convert to snake_case by default.

    }, {
        key: 'clearUserFieldChanges',
        value: function clearUserFieldChanges() {
            this.__changes.clear();
        }
    }, {
        key: 'clearUserFileChanges',
        value: function clearUserFileChanges() {
            this.__fileChanges = {};
            this.__fileDeletions = {};
            this.__fileExists = {};
        }
    }, {
        key: 'clearUserChanges',
        value: function clearUserChanges() {
            this.clearUserFieldChanges();
            this.clearUserFileChanges();
        }
    }, {
        key: 'toBackend',
        value: function toBackend() {
            var _this4 = this;

            var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var _ref$data = _ref.data,
                data = _ref$data === undefined ? {} : _ref$data,
                _ref$mapData = _ref.mapData,
                mapData = _ref$mapData === undefined ? function (x) {
                return x;
            } : _ref$mapData,
                options = objectWithoutProperties(_ref, ['data', 'mapData']);

            var output = {};
            // By default we'll include all fields (attributes+relations), but sometimes you might want to specify the fields to be included.
            var fieldFilter = function fieldFilter(field) {
                if (!_this4.fieldFilter(field)) {
                    return false;
                }
                if (options.fields) {
                    return options.fields.includes(field);
                }
                if (!_this4.isNew && options.onlyChanges) {
                    var forceFields = options.forceFields || [];
                    return forceFields.includes(field) || _this4.__changes.includes(field) || _this4[field] instanceof Store && _this4[field].hasSetChanges ||
                    // isNew is always true for relations that haven't been saved.
                    // If no property has been tweaked, its id serializes as null.
                    // So, we need to skip saving the id if new and no changes.
                    _this4[field] instanceof Model && _this4[field].isNew && _this4[field].hasUserChanges;
                }
                return true;
            };
            this.__attributes.filter(fieldFilter).forEach(function (attr) {
                if (!attr.startsWith('_')) {
                    output[_this4.constructor.toBackendAttrKey(attr)] = _this4.__toJSAttr(attr, _this4[attr]);
                }
            });

            // Primary key is always forced to be included.
            output[this.constructor.primaryKey] = this[this.constructor.primaryKey];

            // Add active relations as id.
            this.__activeCurrentRelations.filter(fieldFilter).forEach(function (currentRel) {
                var rel = _this4[currentRel];
                var relBackendName = _this4.constructor.toBackendAttrKey(currentRel);
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
    }, {
        key: 'toBackendAll',
        value: function toBackendAll() {
            var _this5 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var nestedRelations = options.nestedRelations || {};
            var data = this.toBackend({
                data: options.data,
                mapData: options.mapData,
                onlyChanges: options.onlyChanges
            });

            if (data[this.constructor.primaryKey] === null) {
                data[this.constructor.primaryKey] = this.getNegativeId();
            }

            var relations = {};

            this.__activeCurrentRelations.forEach(function (currentRel) {
                var rel = _this5[currentRel];
                var relBackendName = _this5.constructor.toBackendAttrKey(currentRel);
                var subRelations = nestedRelations[currentRel];

                if (subRelations !== undefined) {
                    if (data[relBackendName] === null) {
                        data[relBackendName] = rel.getNegativeId();
                    } else if (lodash.isArray(data[relBackendName])) {
                        data[relBackendName] = lodash.uniq(data[relBackendName].map(function (pk, i) {
                            return pk === null ? rel.at(i).getNegativeId() : pk;
                        }));
                    } else if (options.onlyChanges && !rel.hasUserChanges) {
                        return;
                    }

                    var relBackendData = rel.toBackendAll({
                        nestedRelations: subRelations,
                        onlyChanges: options.onlyChanges
                    });

                    // Sometimes the backend knows the relation by a different name, e.g. the relation is called
                    // `activities`, but the name in the backend is `activity`.
                    // In that case, you can add `static backendResourceName = 'activity';` to that model.
                    var realBackendName = rel.constructor.backendResourceName || relBackendName;

                    if (relBackendData.data.length > 0) {
                        concatInDict(relations, realBackendName, relBackendData.data);

                        // De-duplicate relations based on `primaryKey`.
                        // TODO: Avoid serializing recursively multiple times in the first place?
                        // TODO: What if different relations have different "freshness"?
                        relations[realBackendName] = lodash.uniqBy(relations[realBackendName], rel.constructor.primaryKey || rel.Model.primaryKey);
                    }

                    // There could still be changes in nested relations,
                    // include those anyway!
                    lodash.forIn(relBackendData.relations, function (relB, key) {
                        concatInDict(relations, key, relB);
                    });
                }
            });

            return { data: [data], relations: relations };
        }
    }, {
        key: 'toJS',
        value: function toJS() {
            var _this6 = this;

            var output = {};
            this.__attributes.forEach(function (attr) {
                output[attr] = _this6.__toJSAttr(attr, _this6[attr]);
            });

            this.__activeCurrentRelations.forEach(function (currentRel) {
                var model = _this6[currentRel];
                if (model) {
                    output[currentRel] = model.toJS();
                }
            });
            return output;
        }
    }, {
        key: '__toJSAttr',
        value: function __toJSAttr(attr, value) {
            var casts = this.casts();
            var cast = casts[attr];
            if (cast !== undefined) {
                return mobx.toJS(cast.toJS(attr, value));
            }
            return mobx.toJS(value);
        }
    }, {
        key: 'setFetchParams',
        value: function setFetchParams(params) {
            this.__fetchParams = Object.assign({}, params);
        }
    }, {
        key: '__parseRepositoryToData',
        value: function __parseRepositoryToData(key, repository) {
            if (lodash.isArray(key)) {
                return lodash.filter(repository, function (m) {
                    return key.includes(m.id);
                });
            }
            return lodash.find(repository, { id: key });
        }
    }, {
        key: '__parseReverseRepositoryToData',
        value: function __parseReverseRepositoryToData(reverseKeyName, key, repository) {
            var searchKey = {};
            searchKey[reverseKeyName] = key;
            return lodash.filter(repository, searchKey);
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

    }, {
        key: '__scopeBackendResponse',
        value: function __scopeBackendResponse(_ref2) {
            var _this7 = this;

            var data = _ref2.data,
                targetRelName = _ref2.targetRelName,
                repos = _ref2.repos,
                mapping = _ref2.mapping,
                reverseMapping = _ref2.reverseMapping;

            var scopedData = null;
            var relevant = false;
            var scopedRepos = {};
            var scopedRelMapping = {};
            var scopedReverseRelMapping = {};

            if (!data) {
                return null;
            }

            lodash.forIn(mapping, function (repoName, backendRelName) {
                var repository = repos[repoName];
                // For backwards compatibility, reverseMapping is optional (for now)
                var reverseRelName = reverseMapping ? reverseMapping[backendRelName] : null;
                var relName = _this7.constructor.fromBackendAttrKey(backendRelName);

                if (targetRelName === relName) {
                    var relKey = data[_this7.constructor.toBackendAttrKey(relName)];
                    if (relKey !== undefined) {
                        relevant = true;
                        scopedData = _this7.__parseRepositoryToData(relKey, repository);
                    } else if (repository && reverseRelName) {
                        var pk = data[_this7.constructor.primaryKey];
                        relevant = true;
                        scopedData = _this7.__parseReverseRepositoryToData(reverseRelName, pk, repository);
                        if (_this7.relations(relName).prototype instanceof Model) {
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

                if (relName.startsWith(targetRelName + '.')) {
                    // If we have town.restaurants and the targetRel = town
                    // we need "restaurants" in the repository
                    relevant = true;
                    var backendRelNames = backendRelName.match(RE_SPLIT_FIRST_RELATION);
                    var scopedBackendRelName = backendRelNames[2];
                    scopedRepos[repoName] = repository;
                    scopedRelMapping[scopedBackendRelName] = repoName;
                    scopedReverseRelMapping[scopedBackendRelName] = reverseMapping ? reverseMapping[backendRelName] : null;
                }
            });

            if (!relevant) {
                return null;
            }

            return { scopedData: scopedData, scopedRepos: scopedRepos, scopedRelMapping: scopedRelMapping, scopedReverseRelMapping: scopedReverseRelMapping };
        }

        // `data` contains properties for the current model.
        // `repos` is an object of "repositories". A repository is
        // e.g. "animal_kind", while the relation name would be "kind".
        // `relMapping` maps relation names to repositories.

    }, {
        key: 'fromBackend',
        value: function fromBackend(_ref3) {
            var _this8 = this;

            var data = _ref3.data,
                repos = _ref3.repos,
                relMapping = _ref3.relMapping,
                reverseRelMapping = _ref3.reverseRelMapping;

            // We handle the fromBackend recursively. On each relation of the source model
            // fromBackend gets called as well, but with data scoped for itself
            //
            // So when we have a model with a `town.restaurants.chef` relation,
            // we call fromBackend on the `town` relation.
            lodash.each(this.__activeCurrentRelations, function (relName) {
                var rel = _this8[relName];
                var resScoped = _this8.__scopeBackendResponse({
                    data: data,
                    targetRelName: relName,
                    repos: repos,
                    mapping: relMapping,
                    reverseMapping: reverseRelMapping
                });

                // Make sure we don't parse every relation for nothing
                if (!resScoped) {
                    return;
                }

                var scopedData = resScoped.scopedData,
                    scopedRepos = resScoped.scopedRepos,
                    scopedRelMapping = resScoped.scopedRelMapping,
                    scopedReverseRelMapping = resScoped.scopedReverseRelMapping;

                rel.fromBackend({
                    data: scopedData,
                    repos: scopedRepos,
                    relMapping: scopedRelMapping,
                    reverseRelMapping: scopedReverseRelMapping
                });
            });

            // Now all repositories are set on the relations, start parsing the actual data.
            // `parse()` will recursively fill in all relations.
            if (data) {
                this.parse(data);
            }
        }
    }, {
        key: '__getApi',
        value: function __getApi() {
            invariant(this.api, 'You are trying to perform a API request without an `api` property defined on the model.');
            invariant(lodash.result(this, 'urlRoot'), 'You are trying to perform a API request without an `urlRoot` property defined on the model.');
            return this.api;
        }
    }, {
        key: 'parse',
        value: function parse(data) {
            var _this9 = this;

            invariant(lodash.isPlainObject(data), 'Parameter supplied to `parse()` is not an object, got: ' + JSON.stringify(data));

            lodash.forIn(data, function (value, key) {
                var attr = _this9.constructor.fromBackendAttrKey(key);
                if (_this9.__attributes.includes(attr)) {
                    _this9[attr] = _this9.__parseAttr(attr, value);
                } else if (_this9.__activeCurrentRelations.includes(attr)) {
                    // In Binder, a relation property is an `int` or `[int]`, referring to its ID.
                    // However, it can also be an object if there are nested relations (non flattened).
                    if (lodash.isPlainObject(value) || Array.isArray(value) && value.every(lodash.isPlainObject)) {
                        _this9[attr].parse(value);
                    } else if (value === null) {
                        // The relation is cleared.
                        _this9[attr].clear();
                    }
                }
            });

            return this;
        }
    }, {
        key: '__parseAttr',
        value: function __parseAttr(attr, value) {
            var casts = this.casts();
            var cast = casts[attr];
            if (cast !== undefined) {
                return cast.parse(attr, value);
            }
            return value;
        }
    }, {
        key: 'uuidv4',
        value: function uuidv4() {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
                return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
            });
        }
    }, {
        key: 'saveFile',
        value: function saveFile(name) {
            var _this10 = this;

            var snakeName = camelToSnake(name);

            if (this.__fileChanges[name]) {
                var file = this.__fileChanges[name];

                // debugger;

                var data = new FormData();

                if (this.isBase64(file)) {
                    var newfile = this.dataURItoBlob(file);
                    // file = `${URL.createObjectURL(blob)}`;
                    var fname = this.uuidv4() + '.png';
                    data.append(name, newfile, fname);
                } else {
                    data.append(name, file, file.name);
                }

                return this.api.post('' + this.url + snakeName + '/', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(mobx.action(function (res) {
                    _this10.__fileExists[name] = true;
                    delete _this10.__fileChanges[name];
                    _this10.saveFromBackend(res);
                }));
            } else if (this.__fileDeletions[name]) {
                if (this.__fileExists[name]) {
                    return this.api.delete('' + this.url + snakeName + '/').then(mobx.action(function () {
                        _this10.__fileExists[name] = false;
                        delete _this10.__fileDeletions[name];
                        _this10.saveFromBackend({ data: defineProperty({}, snakeName, null) });
                    }));
                } else {
                    delete this.__fileDeletions[name];
                }
            } else {
                return Promise.resolve();
            }
        }
    }, {
        key: 'saveFiles',
        value: function saveFiles() {
            return Promise.all(this.fileFields().filter(this.fieldFilter).map(this.saveFile));
        }
    }, {
        key: 'save',
        value: function save() {
            var _this11 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.clearValidationErrors();
            return this.wrapPendingRequestCount(this.__getApi().saveModel({
                url: options.url || this.url,
                data: this.toBackend({
                    data: options.data,
                    mapData: options.mapData,
                    fields: options.fields,
                    onlyChanges: options.onlyChanges
                }),
                isNew: this.isNew,
                requestOptions: lodash.omit(options, 'url', 'data', 'mapData')
            }).then(mobx.action(function (res) {
                _this11.saveFromBackend(_extends({}, res, {
                    data: lodash.omit(res.data, _this11.fileFields().map(camelToSnake))
                }));
                _this11.clearUserFieldChanges();
                return _this11.saveFiles().then(function () {
                    _this11.clearUserFileChanges();
                    return Promise.resolve(res);
                });
            })).catch(mobx.action(function (err) {
                if (err.valErrors) {
                    _this11.parseValidationErrors(err.valErrors);
                }
                throw err;
            })));
        }
    }, {
        key: 'isBase64',
        value: function isBase64(str) {
            if ((typeof str === 'undefined' ? 'undefined' : _typeof(str)) === 'object' || str === undefined || str === null) {
                return false;
            }
            if (str === '' || str.trim() === '') {
                return false;
            }
            str = str.replace(/^[^,]+,/, '');
            try {
                return btoa(atob(str)) === atob(btoa(str));
            } catch (err) {
                return false;
            }
        }
    }, {
        key: 'dataURItoBlob',
        value: function dataURItoBlob(dataURI) {
            var mime = dataURI.split(',')[0].split(':')[1].split(';')[0];
            var binary = atob(dataURI.split(',')[1]);
            var array = [];
            for (var i = 0; i < binary.length; i++) {
                array.push(binary.charCodeAt(i));
            }
            return new Blob([new Uint8Array(array)], { type: mime });
        }
    }, {
        key: 'setInput',
        value: function setInput(name, value) {
            invariant(this.__attributes.includes(name) || this.__activeCurrentRelations.includes(name), 'Field `' + name + '` does not exist on the model.');
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

                    if (!this.isBase64File) {
                        value = URL.createObjectURL(value) + '?content_type=' + value.type;
                    } else {
                        var blob = this.dataURItoBlob(value);
                        value = '' + URL.createObjectURL(blob);
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
                if (lodash.isArray(value)) {
                    this[name].clear();
                    this[name].add(value.map(function (v) {
                        return v.toJS();
                    }));
                } else if (value) {
                    this[name].parse(value.toJS());
                } else {
                    this[name].clear();
                }
            } else {
                this[name] = value;
            }
            if (this.backendValidationErrors[name]) {
                this.__backendValidationErrors = Object.assign(this.backendValidationErrors, defineProperty({}, name, undefined));
            }
        }
    }, {
        key: 'saveAllFiles',
        value: function saveAllFiles() {
            var relations = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var promises = [this.saveFiles()];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = Object.keys(relations)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var rel = _step.value;

                    promises.push(this[rel].saveAllFiles(relations[rel]));
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return Promise.all(promises);
        }
    }, {
        key: 'saveAll',
        value: function saveAll() {
            var _this12 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.clearValidationErrors();
            return this.wrapPendingRequestCount(this.__getApi().saveAllModels({
                url: lodash.result(this, 'urlRoot'),
                model: this,
                data: this.toBackendAll({
                    data: options.data,
                    mapData: options.mapData,
                    nestedRelations: relationsToNestedKeys(options.relations || []),
                    onlyChanges: options.onlyChanges
                }),
                requestOptions: lodash.omit(options, 'relations', 'data', 'mapData')
            }).then(mobx.action(function (res) {
                _this12.saveFromBackend(res);
                _this12.clearUserFieldChanges();

                forNestedRelations(_this12, relationsToNestedKeys(options.relations || []), function (relation) {
                    if (relation instanceof Model) {
                        relation.clearUserFieldChanges();
                    } else {
                        relation.clearSetChanges();
                    }
                });

                return _this12.saveAllFiles(relationsToNestedKeys(options.relations || [])).then(function () {
                    _this12.clearUserFileChanges();

                    forNestedRelations(_this12, relationsToNestedKeys(options.relations || []), function (relation) {
                        if (relation instanceof Model) {
                            relation.clearUserFileChanges();
                        }
                    });

                    return res;
                });
            })).catch(mobx.action(function (err) {
                if (err.valErrors) {
                    _this12.parseValidationErrors(err.valErrors);
                }
                throw err;
            })));
        }

        // After saving a model, we should get back an ID mapping from the backend which looks like:
        // `{ "animal": [[-1, 10]] }`

    }, {
        key: '__parseNewIds',
        value: function __parseNewIds(idMaps) {
            var _this13 = this;

            var bName = this.constructor.backendResourceName;
            if (bName && idMaps[bName]) {
                var idMap = idMaps[bName].find(function (ids) {
                    return ids[0] === _this13.getInternalId();
                });
                if (idMap) {
                    this[this.constructor.primaryKey] = idMap[1];
                }
            }
            lodash.each(this.__activeCurrentRelations, function (relName) {
                var rel = _this13[relName];
                rel.__parseNewIds(idMaps);
            });
        }
    }, {
        key: 'validationErrorFormatter',
        value: function validationErrorFormatter(obj) {
            return obj.code;
        }
    }, {
        key: 'parseValidationErrors',
        value: function parseValidationErrors(valErrors) {
            var _this14 = this;

            var bname = this.constructor.backendResourceName;

            if (valErrors[bname]) {
                var id = this.getInternalId();
                // When there is no id or negative id, the backend may use the string 'null'. Bit weird, but eh.
                var errorsForModel = valErrors[bname][id] || valErrors[bname]['null'];
                if (errorsForModel) {
                    var camelCasedErrors = lodash.mapKeys(errorsForModel, function (value, key) {
                        return snakeToCamel(key);
                    });
                    var formattedErrors = lodash.mapValues(camelCasedErrors, function (valError) {
                        return valError.map(_this14.validationErrorFormatter);
                    });
                    this.__backendValidationErrors = formattedErrors;
                }
            }

            this.__activeCurrentRelations.forEach(function (currentRel) {
                _this14[currentRel].parseValidationErrors(valErrors);
            });
        }
    }, {
        key: 'clearValidationErrors',
        value: function clearValidationErrors() {
            var _this15 = this;

            this.__backendValidationErrors = {};
            this.__activeCurrentRelations.forEach(function (currentRel) {
                _this15[currentRel].clearValidationErrors();
            });
        }

        // This is just a pass-through to make it easier to override parsing backend responses from the backend.
        // Sometimes the backend won't return the model after a save because e.g. it is created async.

    }, {
        key: 'saveFromBackend',
        value: function saveFromBackend(res) {
            return this.fromBackend(res);
        }

        // TODO: This is a bit hacky...

    }, {
        key: 'delete',
        value: function _delete() {
            var _this16 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var removeFromStore = function removeFromStore() {
                return _this16.__store ? _this16.__store.remove(_this16) : null;
            };
            if (options.immediate || this.isNew) {
                removeFromStore();
            }
            if (this.isNew) {
                return Promise.resolve();
            }

            return this.wrapPendingRequestCount(this.__getApi().deleteModel({
                url: options.url || this.url,
                requestOptions: lodash.omit(options, ['immediate', 'url'])
            }).then(mobx.action(function () {
                if (!options.immediate) {
                    removeFromStore();
                }
            })));
        }
    }, {
        key: 'buildFetchData',
        value: function buildFetchData(options) {
            return Object.assign(this.__getApi().buildFetchModelParams(this), this.__fetchParams, options.data);
        }
    }, {
        key: 'fetch',
        value: function fetch() {
            var _this17 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            invariant(!this.isNew, 'Trying to fetch model without id!');

            var data = this.buildFetchData(options);
            var promise = this.wrapPendingRequestCount(this.__getApi().fetchModel({
                url: options.url || this.url,
                data: data,
                requestOptions: lodash.omit(options, ['data', 'url'])
            }).then(mobx.action(function (res) {
                _this17.fromBackend(res);
            })));

            return promise;
        }
    }, {
        key: 'clear',
        value: function clear() {
            var _this18 = this;

            lodash.forIn(this.__originalAttributes, function (value, key) {
                _this18[key] = value;
            });

            this.__activeCurrentRelations.forEach(function (currentRel) {
                _this18[currentRel].clear();
            });
        }
    }, {
        key: 'hasUserChanges',
        get: function get$$1() {
            var _this19 = this;

            if (this.__changes.length > 0) {
                return true;
            }
            return this.__activeCurrentRelations.some(function (rel) {
                return _this19[rel].hasUserChanges;
            });
        }
    }, {
        key: 'fieldFilter',
        get: function get$$1() {
            var pickFields = this.pickFields();
            var omitFields = this.omitFields();

            return function (name) {
                return (!pickFields || pickFields.includes(name)) && !omitFields.includes(name);
            };
        }
    }, {
        key: 'backendValidationErrors',
        get: function get$$1() {
            return this.__backendValidationErrors;
        }
    }], [{
        key: 'toBackendAttrKey',
        value: function toBackendAttrKey(attrKey) {
            return camelToSnake(attrKey);
        }

        // In the frontend we don't want to deal with those snake_case attr names.

    }, {
        key: 'fromBackendAttrKey',
        value: function fromBackendAttrKey(attrKey) {
            return snakeToCamel(attrKey);
        }
    }]);
    return Model;
}(), _class2$1.primaryKey = 'id', _class2$1.backendResourceName = '', _class2$1.fileFields = [], _class2$1.pickFields = undefined, _class2$1.omitFields = [], _temp$1), (_descriptor$1 = _applyDecoratedDescriptor$1(_class$1.prototype, '__backendValidationErrors', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {};
    }
}), _descriptor2$1 = _applyDecoratedDescriptor$1(_class$1.prototype, '__pendingRequestCount', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return 0;
    }
}), _descriptor3$1 = _applyDecoratedDescriptor$1(_class$1.prototype, '__fetchParams', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {};
    }
}), _descriptor4$1 = _applyDecoratedDescriptor$1(_class$1.prototype, '__changes', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return [];
    }
}), _descriptor5$1 = _applyDecoratedDescriptor$1(_class$1.prototype, '__fileChanges', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {};
    }
}), _descriptor6 = _applyDecoratedDescriptor$1(_class$1.prototype, '__fileDeletions', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {};
    }
}), _descriptor7 = _applyDecoratedDescriptor$1(_class$1.prototype, '__fileExists', [mobx.observable], {
    enumerable: true,
    initializer: function initializer() {
        return {};
    }
}), _applyDecoratedDescriptor$1(_class$1.prototype, 'url', [mobx.computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'url'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'isNew', [mobx.computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'isNew'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'isLoading', [mobx.computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'isLoading'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, '__parseRelations', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, '__parseRelations'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'hasUserChanges', [mobx.computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasUserChanges'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fieldFilter', [mobx.computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fieldFilter'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fromBackend', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fromBackend'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'parse', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'parse'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'save', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'save'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'setInput', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'setInput'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'saveAll', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'saveAll'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'parseValidationErrors', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'parseValidationErrors'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'clearValidationErrors', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'clearValidationErrors'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'backendValidationErrors', [mobx.computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'backendValidationErrors'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'delete', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'delete'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fetch', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fetch'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'clear', [mobx.action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'clear'), _class$1.prototype)), _class$1);

// Function ripped from Django docs.
// See: https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
function csrfSafeMethod(method) {
    // These HTTP methods do not require CSRF protection.
    return (/^(GET|HEAD|OPTIONS|TRACE)$/i.test(method)
    );
}

var BinderApi = function () {
    function BinderApi() {
        classCallCheck(this, BinderApi);
        this.baseUrl = null;
        this.csrfToken = null;
        this.defaultHeaders = {};
        this.axios = axios.create();

        this.__initializeCsrfHandling();
    }

    createClass(BinderApi, [{
        key: '__initializeCsrfHandling',
        value: function __initializeCsrfHandling() {
            var _this = this;

            this.axios.interceptors.response.use(null, function (err) {
                var status = lodash.get(err, 'response.status');
                var statusErrCode = lodash.get(err, 'response.data.code');
                var doNotRetry = lodash.get(err, 'response.config.doNotRetry');
                if (status === 403 && statusErrCode === 'CSRFFailure' && !doNotRetry) {
                    return _this.fetchCsrfToken().then(function () {
                        return _this.axios(_extends({}, err.response.config, {
                            doNotRetry: true
                        }));
                    });
                }
                return Promise.reject(err);
            });
        }
    }, {
        key: '__request',
        value: function __request(method, url, data, options) {
            options || (options = {});
            var useCsrfToken = csrfSafeMethod(method) ? undefined : this.csrfToken;
            this.__testUrl(url);

            var axiosOptions = {
                method: method,
                baseURL: this.baseUrl,
                url: url,
                data: method !== 'get' && data ? data : undefined,
                params: method === 'get' && data ? data : options.params
            };

            Object.assign(axiosOptions, options);

            // Don't clear existing headers when adding `options.headers`
            var headers = Object.assign({
                'Content-Type': 'application/json',
                'X-Csrftoken': useCsrfToken
            }, this.defaultHeaders, options.headers);
            axiosOptions.headers = headers;

            var xhr = this.axios(axiosOptions);

            // We fork the promise tree as we want to have the error traverse to the listeners
            if (this.onRequestError && options.skipRequestError !== true) {
                xhr.catch(this.onRequestError);
            }

            var onSuccess = options.skipFormatter === true ? Promise.resolve() : this.__responseFormatter;
            return xhr.then(onSuccess);
        }
    }, {
        key: 'parseBackendValidationErrors',
        value: function parseBackendValidationErrors(response) {
            var valErrors = lodash.get(response, 'data.errors');
            if (response.status === 400 && valErrors) {
                return valErrors;
            }
            return null;
        }
    }, {
        key: 'fetchCsrfToken',
        value: function fetchCsrfToken() {
            var _this2 = this;

            return this.get('/api/bootstrap/').then(function (res) {
                _this2.csrfToken = res.csrf_token;
            });
        }
    }, {
        key: '__responseFormatter',
        value: function __responseFormatter(res) {
            return res.data;
        }
    }, {
        key: '__testUrl',
        value: function __testUrl(url) {
            if (!url.endsWith('/')) {
                throw new Error('Binder does not accept urls that do not have a trailing slash: ' + url);
            }
        }
    }, {
        key: 'get',
        value: function get$$1(url, data, options) {
            return this.__request('get', url, data, options);
        }
    }, {
        key: 'post',
        value: function post(url, data, options) {
            return this.__request('post', url, data, options);
        }
    }, {
        key: 'patch',
        value: function patch(url, data, options) {
            return this.__request('patch', url, data, options);
        }
    }, {
        key: 'put',
        value: function put(url, data, options) {
            return this.__request('put', url, data, options);
        }
    }, {
        key: 'delete',
        value: function _delete(url, data, options) {
            return this.__request('delete', url, data, options);
        }
    }, {
        key: 'buildFetchModelParams',
        value: function buildFetchModelParams(model) {
            return {
                // TODO: I really dislike that this is comma separated and not an array.
                // We should fix this in the Binder API.
                with: model.__activeRelations.map(model.constructor.toBackendAttrKey).join(',') || null
            };
        }
    }, {
        key: 'fetchModel',
        value: function fetchModel(_ref) {
            var url = _ref.url,
                data = _ref.data,
                requestOptions = _ref.requestOptions;

            return this.get(url, data, requestOptions).then(function (res) {
                return {
                    data: res.data,
                    repos: res.with,
                    relMapping: res.with_mapping,
                    reverseRelMapping: res.with_related_name_mapping
                };
            });
        }
    }, {
        key: 'saveModel',
        value: function saveModel(_ref2) {
            var _this3 = this;

            var url = _ref2.url,
                data = _ref2.data,
                isNew = _ref2.isNew,
                requestOptions = _ref2.requestOptions;

            var method = isNew ? 'post' : 'patch';
            return this[method](url, data, requestOptions).then(function (newData) {
                return { data: newData };
            }).catch(function (err) {
                if (err.response) {
                    err.valErrors = _this3.parseBackendValidationErrors(err.response);
                }
                throw err;
            });
        }
    }, {
        key: 'saveAllModels',
        value: function saveAllModels(_ref3) {
            var _this4 = this;

            var url = _ref3.url,
                data = _ref3.data,
                model = _ref3.model,
                requestOptions = _ref3.requestOptions;

            return this.put(url, {
                data: data.data,
                with: data.relations
            }, requestOptions).then(function (res) {
                if (res.idmap) {
                    model.__parseNewIds(res.idmap);
                }
                return res;
            }).catch(function (err) {
                if (err.response) {
                    err.valErrors = _this4.parseBackendValidationErrors(err.response);
                }
                throw err;
            });
        }
    }, {
        key: 'deleteModel',
        value: function deleteModel(_ref4) {
            var url = _ref4.url,
                requestOptions = _ref4.requestOptions;

            // TODO: kind of silly now, but we'll probably want better error handling soon.
            return this.delete(url, null, requestOptions);
        }
    }, {
        key: 'buildFetchStoreParams',
        value: function buildFetchStoreParams(store) {
            var offset = store.getPageOffset();
            var limit = store.__state.limit;
            return {
                with: store.__activeRelations.map(store.Model.toBackendAttrKey).join(',') || null,
                limit: limit === null ? 'none' : limit,
                // Hide offset if zero so the request looks cleaner in DevTools.
                offset: offset || null
            };
        }
    }, {
        key: 'fetchStore',
        value: function fetchStore(_ref5) {
            var url = _ref5.url,
                data = _ref5.data,
                requestOptions = _ref5.requestOptions;

            return this.get(url, data, requestOptions).then(function (res) {
                return {
                    response: res,
                    data: res.data,
                    repos: res.with,
                    relMapping: res.with_mapping,
                    reverseRelMapping: res.with_related_name_mapping,
                    totalRecords: res.meta.total_records
                };
            });
        }
    }]);
    return BinderApi;
}();

var DATE_LIB = 'moment';
var SUPPORTED_DATE_LIBS = ['moment', 'luxon'];

function configureDateLib(dateLib) {
    invariant(SUPPORTED_DATE_LIBS.includes(dateLib), 'Unsupported date lib `' + dateLib + '`. ' + ('(Supported: ' + SUPPORTED_DATE_LIBS.map(function (dateLib) {
        return '`' + dateLib + '`';
    }).join(', ') + ')'));
    DATE_LIB = dateLib;
}

function checkMomentInstance(attr, value) {
    invariant(moment.isMoment(value), 'Attribute `' + attr + '` is not a moment instance.');
}

function checkLuxonDateTime(attr, value) {
    invariant(luxon.DateTime.isDateTime(value), 'Attribute `' + attr + '` is not a luxon instance.');
}

var LUXON_DATE_FORMAT = 'yyyy-LL-dd';
var LUXON_DATETIME_FORMAT = "yyyy'-'LL'-'dd'T'HH':'mm':'ssZZ";

var CASTS = {
    momentDate: {
        parse: function parse(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            return moment(value, 'YYYY-MM-DD');
        },
        toJS: function toJS(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.format('YYYY-MM-DD');
        },

        dateLib: 'moment'
    },
    momentDatetime: {
        parse: function parse(attr, value) {
            if (value === null) {
                return null;
            }
            return moment(value);
        },
        toJS: function toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.toJSON(); // Use ISO8601 notation, adjusted to UTC
        },

        dateLib: 'moment'
    },
    luxonDate: {
        parse: function parse(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            return luxon.DateTime.fromISO(value);
        },
        toJS: function toJS(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            checkLuxonDateTime(attr, value);
            return value.toFormat(LUXON_DATE_FORMAT);
        },

        dateLib: 'luxon'
    },
    luxonDatetime: {
        parse: function parse(attr, value) {
            if (value === null) {
                return null;
            }

            return luxon.DateTime.fromISO(value);
        },
        toJS: function toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkLuxonDateTime(attr, value);
            return value.toFormat(LUXON_DATETIME_FORMAT);
        },

        dateLib: 'luxon'
    },
    date: {
        parse: function parse() {
            var _CASTS$;

            return (_CASTS$ = CASTS[DATE_LIB + 'Date']).parse.apply(_CASTS$, arguments);
        },
        toJS: function toJS() {
            var _CASTS$2;

            return (_CASTS$2 = CASTS[DATE_LIB + 'Date']).toJS.apply(_CASTS$2, arguments);
        },

        get dateLib() {
            return DATE_LIB;
        }
    },
    datetime: {
        parse: function parse() {
            var _CASTS$3;

            return (_CASTS$3 = CASTS[DATE_LIB + 'Datetime']).parse.apply(_CASTS$3, arguments);
        },
        toJS: function toJS() {
            var _CASTS$4;

            return (_CASTS$4 = CASTS[DATE_LIB + 'Datetime']).toJS.apply(_CASTS$4, arguments);
        },

        get dateLib() {
            return DATE_LIB;
        }
    },
    enum: function _enum(expectedValues) {
        invariant(lodash.isArray(expectedValues), 'Invalid argument suplied to `Casts.enum`, expected an instance of array.');
        function checkExpectedValues(attr, value) {
            if (value === null) {
                return null;
            }
            if (expectedValues.includes(value)) {
                return value;
            }
            invariant(false, 'Value set to attribute `' + attr + '`, ' + JSON.stringify(value) + ', is not one of the allowed enum: ' + JSON.stringify(expectedValues));
        }
        return {
            parse: checkExpectedValues,
            toJS: checkExpectedValues
        };
    }
};

exports.Model = Model;
exports.Store = Store;
exports.BinderApi = BinderApi;
exports.Casts = CASTS;
exports.configureDateLib = configureDateLib;
