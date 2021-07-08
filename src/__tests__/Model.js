import axios from 'axios';
import { toJS, observable } from 'mobx';
import MockAdapter from 'axios-mock-adapter';
import _ from 'lodash';
import { Model, BinderApi, Casts } from '../';
import { compareObjectsIgnoringNegativeIds } from "./helpers/helpers";
import {
    Animal,
    AnimalStore,
    AnimalWithArray,
    AnimalWithObject,
    AnimalWithFrontendProp,
    AnimalWithoutApi,
    AnimalWithoutUrl,
    AnimalCircular,
    AnimalResourceName,
    KindResourceName,
    Kind,
    Breed,
    Person,
    PersonStore,
    Location,
} from './fixtures/Animal';
import { Customer, Location as CLocation } from './fixtures/Customer';
import animalKindBreedData from './fixtures/animal-with-kind-breed.json';
import animalsWithPastOwnersAndTownData from './fixtures/animals-with-past-owners-and-town.json';
import animalKindBreedDataNested from './fixtures/animal-with-kind-breed-nested.json';
import animalMultiPutResponse from './fixtures/animals-multi-put-response.json';
import animalMultiPutError from './fixtures/animals-multi-put-error.json';
import customersWithTownCookRestaurant from './fixtures/customers-with-town-cook-restaurant.json';
import customerWithoutTownRestaurants from './fixtures/customer-without-town-restaurants.json';
import customersLocationBestCookWorkPlaces from './fixtures/customers-location-best-cook-work-places.json';
import saveFailData from './fixtures/save-fail.json';
import saveNewFailData from './fixtures/save-new-fail.json';

beforeEach(() => {
    // Refresh lodash's `_.uniqueId` internal state for every test
    let idCounter = 0;
    _.uniqueId = jest.fn(() => {
        idCounter += 1;
        return idCounter;
    });
});

test('Initialize model with valid data', () => {
    const animal = new Animal({
        id: 2,
        name: 'Monkey',
    });

    expect(animal.id).toBe(2);
    expect(animal.name).toBe('Monkey');
});

test('Initialize model with invalid data', () => {
    const animal = new Animal({
        nonExistentProperty: 'foo',
    });

    expect(animal.nonExistentProperty).toBeUndefined();
});

test('Initialize model without data', () => {
    const animal = new Animal(null);

    expect(animal.id).toBeLessThan(0);
    expect(animal.name).toBe('');
});

test('Chaining parse', () => {
    const animal = new Animal().parse({});

    expect(animal).toBeInstanceOf(Animal);
});

test('`cid` should be a unique value`', () => {
    expect(new Animal().cid).toBe('m1');
    expect(new Animal().cid).toBe('m2');
});

test('primaryKey defined as not static should throw error', () => {
    class Zebra extends Model {
        primaryKey = 'blaat';
    }

    expect(() => {
        return new Zebra();
    }).toThrow('`primaryKey` should be a static property on the model.');
});

test('property defined as both attribute and relation should throw error', () => {
    class Zebra extends Model {
        @observable kind = '';

        relation() {
            return { kind: Kind };
        }
    }

    expect(() => {
        return new Zebra(null, { relations: ['kind'] });
    }).toThrow(
        'Cannot define `kind` as both an attribute and a relation. You probably need to remove the attribute.'
    );
});

test('initialize() method should be called', () => {
    const initMock = jest.fn();

    class Zebra extends Model {
        initialize() {
            initMock();
        }
    }

    new Zebra();
    expect(initMock.mock.calls.length).toBe(1);
});

test('URL should be correct without primary key', () => {
    const animal = new Animal();

    expect(animal.url).toBe('/api/animal/');
});

test('URL should be correct with primary key', () => {
    const animal = new Animal({ id: 2 });

    expect(animal.url).toBe('/api/animal/2/');
});

test('Relation should not be initialized by default', () => {
    const animal = new Animal();

    expect(animal.kind).toBeUndefined();
});

test('Initialize one-level relation', () => {
    const animal = new Animal(null, {
        relations: ['kind'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
});

test('isNew should be true for new model', () => {
    const animal = new Animal();

    expect(animal.isNew).toBe(true);
});

test('isNew should be true for a model with negative id', () => {
    const animal = new Animal();
    animal.id = animal.getInternalId();

    expect(animal.isNew).toBe(true);
});

test('isNew should be true for a model that we assign an internal id', () => {
    const animal = new Animal();
    animal.assignInternalId();

    expect(animal.isNew).toBe(true);
    expect(animal.id).toBeLessThan(0);
});


test('isNew should be false for existing model', () => {
    const animal = new Animal({ id: 2 });

    expect(animal.isNew).toBe(false);
});

test('Initialize two-level relation', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
    expect(animal.kind.breed).toBeInstanceOf(Breed);
});

test('Initialize three-level relation', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed.location'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
    expect(animal.kind.breed).toBeInstanceOf(Breed);
    expect(animal.kind.breed.location).toBeInstanceOf(Location);
});

test('Initialize multiple relations', () => {
    const animal = new Animal(null, {
        relations: ['kind', 'owner'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
    expect(animal.owner).toBeInstanceOf(Person);
});

test('Initialize circular model', () => {
    const animal = new AnimalCircular(
        {
            id: 2,
            circular: {
                id: 3,
            },
        },
        { relations: ['circular'] }
    );

    expect(animal.id).toBe(2);
    expect(animal.circular).toBeInstanceOf(AnimalCircular);
    expect(animal.circular.circular).toBeUndefined();
    expect(animal.circular.id).toBe(3);
});

test('Initialize multiple nested relations', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed', 'kind.location'],
    });

    expect(animal.kind.breed).toBeInstanceOf(Breed);
    expect(animal.kind.location).toBeInstanceOf(Location);
});

test('Attributes list', () => {
    const animal = new Animal();

    expect(animal.__attributes).toEqual(['id', 'name']);
});

test('Non-object given to parse() should throw an error', () => {
    expect(() => {
        const animal = new Animal();
        return animal.parse(1);
    }).toThrow('Parameter supplied to `parse()` is not an object, got: 1');
});

test('Non existent relation should throw an error', () => {
    expect(() => {
        return new Animal(null, {
            relations: ['ponyfoo'],
        });
    }).toThrow('Specified relation "ponyfoo" does not exist on model.');
});

test('Parsing two-level relation (with repos)', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed'],
    });

    animal.fromBackend({
        data: animalKindBreedData.data,
        repos: animalKindBreedData.with,
        relMapping: animalKindBreedData.with_mapping,
    });

    expect(animal.id).toBe(1);
    expect(animal.name).toBe('Woofer');
    expect(animal.kind.id).toBe(4);
    expect(animal.kind.name).toBe('Good Dog');
    expect(animal.kind.breed.id).toBe(3);
    expect(animal.kind.breed.name).toBe('Good Pupper');
});

test('Parsing two times', () => {
    const animal = new Animal({
        id: 2,
    });

    animal.fromBackend({
        data: { name: 'Woofer' },
    });

    expect(animal.id).toBe(2);
    expect(animal.name).toBe('Woofer');
});

test('Parsing empty relation', () => {
    const customer = new CLocation({}, { relations: ['bestCook.currentWork'] });

    customer.fromBackend({
        data: customersLocationBestCookWorkPlaces.data,
        repos: customersLocationBestCookWorkPlaces.with,
        relMapping: customersLocationBestCookWorkPlaces.with_mapping,
    });

    expect(customer.bestCook.id).toBe(null);
});

test('Parsing empty relation which was already set', () => {
    const customer = new CLocation(
        {
            bestCook: {
                id: 1,
                name: 'Zaico',
                profession: 'Noob',
            },
        },
        { relations: ['bestCook.currentWork'] }
    );

    expect(customer.bestCook.id).toBe(1);
    expect(customer.bestCook.name).toBe('Zaico');
    expect(customer.bestCook.profession).toBe('Noob');

    customer.fromBackend({
        data: customersLocationBestCookWorkPlaces.data,
        repos: customersLocationBestCookWorkPlaces.with,
        relMapping: customersLocationBestCookWorkPlaces.with_mapping,
    });

    expect(customer.bestCook.id).toBe(null);
    expect(customer.bestCook.name).toBe('');
    expect(customer.bestCook.profession).toBe('chef');
});

test('Parsing two-level relation (nested)', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed'],
    });

    animal.fromBackend({
        data: animalKindBreedDataNested.data,
    });

    expect(animal.id).toBe(1);
    expect(animal.name).toBe('Woofer');
    expect(animal.kind.id).toBe(4);
    expect(animal.kind.name).toBe('Good Dog');
    expect(animal.kind.breed.id).toBe(3);
    expect(animal.kind.breed.name).toBe('Good Pupper');
});

test('Parsing store relation (nested)', () => {
    const animal = new Animal(null, {
        relations: ['pastOwners'],
    });

    animal.fromBackend({
        data: animalKindBreedDataNested.data,
    });

    expect(animal.id).toBe(1);
    expect(animal.pastOwners.length).toBe(2);
    expect(animal.pastOwners.map('id')).toEqual([50, 51]);
});

test('Parsing two times with store relation', () => {
    const animal = new Animal(null, {
        relations: ['pastOwners'],
    });

    animal.pastOwners.parse([{ id: 3 }]);

    expect(animal.pastOwners.map('id')).toEqual([3]);

    animal.parse({
        name: 'Pupper',
    });

    expect(animal.pastOwners.map('id')).toEqual([3]);
});

test('Parsing store relation with model relation in it', () => {
    const animal = new Animal(null, {
        relations: ['pastOwners.town'],
    });

    expect(animal.pastOwners).not.toBeUndefined();
    expect(animal.pastOwners).toBeInstanceOf(PersonStore);

    animal.fromBackend({
        data: animalsWithPastOwnersAndTownData.data,
        repos: animalsWithPastOwnersAndTownData.with,
        relMapping: animalsWithPastOwnersAndTownData.with_mapping,
    });

    expect(animal.pastOwners.map('id')).toEqual([55, 66]);
    expect(animal.pastOwners.get(55).town).toBeInstanceOf(Location);
    expect(animal.pastOwners.get(55).town.id).toBe(10);
    expect(animal.pastOwners.get(55).town.name).toBe('Eindhoven');
    expect(animal.pastOwners.get(66).town.id).toBe(11);
    expect(animal.pastOwners.get(66).town.name).toBe('Breda');
});

test('Parsing Store -> Model -> Store relation', () => {
    const customer = new Customer(null, {
        relations: ['oldTowns.bestCook.workPlaces'],
    });

    customer.fromBackend({
        data: customersWithTownCookRestaurant.data,
        repos: customersWithTownCookRestaurant.with,
        relMapping: customersWithTownCookRestaurant.with_mapping,
    });

    expect(customer.oldTowns.at(0).bestCook.id).toBe(50);
    expect(customer.oldTowns.at(0).bestCook.workPlaces.map('id')).toEqual([
        5,
        6,
    ]);
});

test('Parsing Model -> Model -> Store with a nullable fk', () => {
    const customer = new Customer(null, {
        relations: ['town.restaurants'],
    });

    customer.fromBackend({
        data: customerWithoutTownRestaurants.data,
        repos: customerWithoutTownRestaurants.with,
        relMapping: customerWithoutTownRestaurants.with_mapping,
    });

    expect(customer.town.restaurants.length).toBe(0);
});

test('toBackend with basic properties', () => {
    const animal = new Animal({
        id: 3,
        name: 'Donkey',
    });

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 3,
        name: 'Donkey',
    });
});

test('toBackend with relations', () => {
    const animal = new Animal(
        {
            id: 4,
            name: 'Donkey',
        },
        { relations: ['kind', 'owner'] }
    );

    animal.kind.id = 8;

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 4,
        name: 'Donkey',
        kind: 8,
        owner: null,
    });
});

test('toBackend with pick fields', () => {
    const model = new class extends Model {
        api = new BinderApi();
        static backendResourceName = 'resource';

        @observable id = 1;
        @observable name = 'Joe';
        @observable color = 'red';
    }();

    // The id field seems to be required i.e cannot be
    // picked away
    model.pickFields = () => {
        return ['color']
    }

    const serialized = model.toBackend();

    expect(serialized).toEqual({
        color: 'red',
        id: 1
    });
});

test('toBackend with pick fields as static attribute', () => {
    const model = new class extends Model {
        api = new BinderApi();
        static backendResourceName = 'resource';
        static pickFields = ['color'];

        @observable id = 1;
        @observable name = 'Joe';
        @observable color = 'red';
    }();

    const serialized = model.toBackend();

    expect(serialized).toEqual({
        color: 'red',
        id: 1
    });
});

test('toBackend with pick fields arrow function', () => {
    const model = new class extends Model {
        api = new BinderApi();
        static backendResourceName = 'resource';
        pickFields = () => ['color'];

        @observable id = 1;
        @observable name = 'Joe';
        @observable color = 'red';
    }();

    const serialized = model.toBackend();

    expect(serialized).toEqual({
        color: 'red',
        id: 1
    });
});


test('toBackend with omit fields', () => {
    const model = new class extends Model {
        api = new BinderApi();
        static backendResourceName = 'resource';

        @observable id = 1;
        @observable name = 'Joe';
        @observable color = 'red';
        @observable weight = 76;
        @observable height = 196;
    }();

    model.omitFields = () => {
        return ['weight', 'height', 'name']
    }

    const serialized = model.toBackend();

    const expected = {
        weight: 32
    }
    expect(serialized).toEqual({
        color: 'red',
        id: 1
    });
});

test('toBackend with omit fields as static attribute', () => {
    const model = new class extends Model {
        api = new BinderApi();
        static backendResourceName = 'resource';
        static omitFields = ['weight', 'height', 'name'];

        @observable id = 1;
        @observable name = 'Joe';
        @observable color = 'red';
        @observable weight = 76;
        @observable height = 196;
    }();

    const serialized = model.toBackend();

    expect(serialized).toEqual({
        color: 'red',
        id: 1
    });
});

test('toBackend with omit fields as arrow function', () => {
    const model = new class extends Model {
        api = new BinderApi();
        static backendResourceName = 'resource';
        omitFields = () => ['weight', 'height', 'name'];

        @observable id = 1;
        @observable name = 'Joe';
        @observable color = 'red';
        @observable weight = 76;
        @observable height = 196;
    }();

    const serialized = model.toBackend();

    expect(serialized).toEqual({
        color: 'red',
        id: 1
    });
});

test('toBackend with specified attributes & relations', () => {
    const animal = new Animal(
        {
            id: 4,
            name: 'Donkey',
        },
        { relations: ['kind', 'owner'] }
    );

    animal.kind.id = 8;

    const serialized = animal.toBackend({ fields: ['id', 'kind'] });

    expect(serialized).toEqual({
        id: 4,
        kind: 8,
    });
});

test('toBackend with store relation', () => {
    const animal = new Animal(
        {
            id: 4,
        },
        { relations: ['pastOwners'] }
    );

    animal.pastOwners.parse([{ id: 5 }]);

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 4,
        name: '',
        past_owners: [5],
    });
});

test('toBackendAll with model relation', () => {
    const animal = new Animal(
        {
            id: 4,
        },
        { relations: ['kind.breed', 'owner'] }
    );

    animal.kind.parse({ id: 5 });

    const serialized = animal.toBackendAll({
        nestedRelations: { kind: { breed: {} }, owner: {} },
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll without relations', () => {
    const animal = new Animal(
        {
            id: 4,
        },
        { relations: ['kind.breed', 'owner'] }
    );

    animal.kind.parse({ id: 5 });
    // Purposefully pass no parameters to toBackendAll()
    const serialized = animal.toBackendAll();
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with partial relations', () => {
    const animal = new Animal(
        {
            name: 'Doggo',
            kind: { name: 'Dog' },
            owner: { name: 'Henk', town: { name: 'Ehv' } },
        },
        { relations: ['kind', 'owner.town'] }
    );
    const serialized = animal.toBackendAll({ nestedRelations: { owner: {} } });
    expect(serialized).toMatchSnapshot();
});

test('Internal relation list should not contain duplicates', () => {
    // I really should not test internals, but this caused hard-to-find bugs in the past
    // so I want to be sure this works.
    const animal = new Animal({}, { relations: ['kind', 'kind.breed'] });

    expect(animal.__activeCurrentRelations).toEqual(['kind']);
});

test('toBackendAll with store relation', () => {
    const animal = new Animal({}, { relations: ['pastOwners'] });

    animal.pastOwners.parse([
        { name: 'Bar' },
        { name: 'Foo' },
        { id: 10, name: 'R' },
    ]);

    const serialized = animal.toBackendAll({ nestedRelations: { pastOwners: {} } });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll should de-duplicate relations', () => {
    const animal = new Animal({}, { relations: ['pastOwners.town'] });

    animal.pastOwners.parse([{ name: 'Bar' }, { name: 'Foo' }]);

    // This is something you should never do, so maybe this is a bad test?
    const animalBar = animal.pastOwners.at(0);
    animal.pastOwners.models[1] = animalBar;

    // This isn't the real test, just a check.
    expect(animalBar.cid).toBe(animal.pastOwners.at(1).cid);

    const serialized = animal.toBackendAll({
        nestedRelations: { pastOwners: { town: {} } },
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with deep nested relation', () => {
    // It's very important to test what happens when the same relation ('location') is used twice + is nested.
    const animal = new Animal(
        {},
        { relations: ['kind.location', 'kind.breed.location'] }
    );

    animal.kind.parse({
        name: 'Aap',
        location: { name: 'Apenheul' },
        breed: { name: 'MyBreed', location: { name: 'Amerika' } },
    });

    const serialized = animal.toBackendAll({
        nestedRelations: { kind: { location: {}, breed: { location: {} } } },
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with nested store relation', () => {
    // It's very important to test what happens when the same relation ('location') is used twice + is nested.
    const animal = new Animal({}, { relations: ['pastOwners.town'] });

    animal.pastOwners.parse([
        {
            name: 'Henk',
            town: {
                name: 'Eindhoven',
            },
        },
        {
            name: 'Krol',
            town: {
                name: 'Breda',
            },
        },
    ]);

    const serialized = animal.toBackendAll({
        nestedRelations: { pastOwners: { town: {} } },
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with `backendResourceName` property model', () => {
    const animal = new AnimalResourceName(
        {},
        { relations: ['blaat', 'owners', 'pastOwners'] }
    );

    animal.parse({
        id: 1,
        blaat: {
            id: 2,
        },
        owners: [
            {
                id: 3,
            },
        ],
        pastOwners: [
            {
                id: 4,
            },
        ],
    });

    const serialized = animal.toBackendAll({
        nestedRelations: { blaat: {}, owners: {}, pastOwners: {} },
    });
    expect(serialized).toMatchSnapshot();
});

test('backendResourceName defined as not static should throw error', () => {
    class Zebra extends Model {
        backendResourceName = 'blaat';
    }

    expect(() => {
        return new Zebra();
    }).toThrow(
        '`backendResourceName` should be a static property on the model.'
    );
});

test('Attribute already used by mobx-spine should throw error', () => {
    // E.g. the `url` property is used by mobx-spine, so you can't use it as an attribute.
    class Zebra extends Model {
        @observable url = '';
    }

    expect(() => {
        return new Zebra();
    }).toThrow('Forbidden attribute key used: `url`');
});

test('toBackend with frontend-only prop', () => {
    const animal = new AnimalWithFrontendProp({
        id: 3,
        _frontend: 'Donkey',
    });

    const serialized = animal.toBackend();

    expect(animal._frontend).toBe('Donkey');
    expect(serialized).toEqual({
        id: 3,
    });
});

test('toBackend with observable array', () => {
    const animal = new AnimalWithArray({
        foo: ['q', 'a'],
    });

    expect(animal.toBackend()).toEqual({
        foo: ['q', 'a'],
        id: -1,
    });
});

test('clear with basic attribute', () => {
    const animal = new Animal({
        id: 2,
        name: 'Monkey',
    });

    animal.clear();

    expect(animal.id).toBeLessThan(0);
    expect(animal.name).toBe('');
});

test('clear with relations', () => {
    const animal = new Animal(
        {
            id: 5,
            name: 'Donkey kong',
        },
        { relations: ['kind', 'owner'] }
    );

    animal.kind.id = 8;

    animal.clear();

    expect(animal.kind.id).toBe(null);
});

test('clear with array attribute', () => {
    const animal = new AnimalWithArray();
    animal.foo.push('bar');

    expect(toJS(animal.foo)).toEqual(['bar']);

    animal.clear();

    expect(toJS(animal.foo)).toEqual([]);
});

test('clear with object attribute', () => {
    const animal = new AnimalWithObject();
    animal.foo.bar = true;

    expect(toJS(animal.foo)).toEqual({ bar: true });

    animal.clear();

    expect(toJS(animal.foo)).toEqual({});
});

test('toJS with basic attributes', () => {
    const animal = new Animal({
        id: 4,
        name: 'japser',
    });

    expect(animal.toJS()).toEqual({
        id: 4,
        name: 'japser',
    });
});

test('toJS with relations', () => {
    const animal = new Animal(
        {
            id: 4,
            name: 'japser',
            kind: { id: 8, breed: { id: 10 } },
        },
        { relations: ['kind.breed'] }
    );

    expect(animal.toJS()).toEqual({
        id: 4,
        name: 'japser',
        kind: {
            id: 8,
            name: '',
            breed: {
                id: 10,
                name: '',
            },
        },
    });
});

test('toJS with observable array', () => {
    const animal = new AnimalWithArray({
        foo: ['q', 'a'],
    });

    expect(animal.toJS()).toEqual({
        foo: ['q', 'a'],
    });
});

test('fetch without id', () => {
    const animal = new Animal();
    expect(() => animal.fetch()).toThrow('Trying to fetch model without id!');
});

test('delete without id and store', () => {
    const animal = new Animal();
    expect(animal.delete()).toBeInstanceOf(Promise);
});

test('fetch without api', () => {
    const animal = new AnimalWithoutApi({ id: 2 });
    expect(() => animal.fetch()).toThrow(
        'You are trying to perform a API request without an `api` property defined on the model.'
    );
});

test('fetch without url', () => {
    const animal = new AnimalWithoutUrl({ id: 2 });
    expect(() => animal.fetch()).toThrow(
        'You are trying to perform a API request without an `urlRoot` property defined on the model.'
    );
});

test('setInput to clear backend validation errors', () => {
    const animal = new Animal();
    animal.__backendValidationErrors = { name: ['required'] };
    expect(toJS(animal.backendValidationErrors.name)).toEqual(['required']);
    animal.setInput('name', 'Jo');
    expect(animal.name).toBe('Jo');
    expect(animal.backendValidationErrors.name).toBe(undefined);
});

test('allow custom validationErrorFormatter', () => {
    const location = new class extends Location {
        static backendResourceName = 'location';

        validationErrorFormatter(obj) {
            return obj.msg;
        }
    }({ id: 2 });

    location.parseValidationErrors({
        location: {
            2: {
                name: [{ msg: 'Error 1' }, { msg: 'Error 2' }],
            },
        },
    });

    expect(toJS(location.backendValidationErrors)).toEqual({
        name: ['Error 1', 'Error 2'],
    });
});

test('setInput on non-existing field', () => {
    const animal = new Animal();
    expect(() => {
        return animal.setInput('asdf', 'Jo');
    }).toThrow('Field `asdf` does not exist on the model.');
});

test('setInput to parse model relation', () => {
    const animal = new Animal(null, { relations: ['kind'] });
    const kind = new Kind({ id: 100 });
    animal.__backendValidationErrors = { kind: ['required'] };
    animal.setInput('kind', kind);
    expect(animal.kind.id).toBe(100);
    // it should parse to a new model, not the existing one
    expect(animal.kind.cid).not.toBe(kind.cid);
    expect(animal.backendValidationErrors.kind).toBe(undefined);

    animal.setInput('kind', null);
    expect(animal.kind.id).toBe(null);
});

test('setInput to parse store relation', () => {
    const animal = new Animal(null, { relations: ['pastOwners'] });
    const pastOwners = [new Person({ id: 2 }), new Person({ id: 3 })];

    animal.setInput('pastOwners', pastOwners);
    expect(animal.pastOwners.map('id')).toEqual([2, 3]);
    expect(animal.pastOwners.at(0).cid).not.toBe(pastOwners[0].cid);

    animal.setInput('pastOwners', null);
    expect(animal.pastOwners.length).toBe(0);
});

test('parse empty list', () => {
    const animal = new Animal(
        { pastOwners: [{}, {}] },
        { relations: ['pastOwners'] },
    );
    expect(animal.pastOwners.length).toEqual(2);
    animal.parse({ pastOwners: [] });
    expect(animal.pastOwners.length).toEqual(0);
});

describe('requests', () => {
    let mock;
    beforeEach(() => {
        mock = new MockAdapter(axios);
    });
    afterEach(() => {
        if (mock) {
            mock.restore();
            mock = null;
        }
    });

    test('fetch with basic properties', () => {
        const animal = new Animal({ id: 2 });
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/2/');
            expect(config.method).toBe('get');
            expect(config.params).toEqual({ with: null });
            return [200, { data: { id: 2, name: 'Madagascar' } }];
        });

        return animal.fetch().then(() => {
            expect(animal.id).toBe(2);
        });
    });

    test('fetch with relations', () => {
        const animal = new Animal(
            { id: 2 },
            {
                relations: ['kind.breed'],
            }
        );
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                with: 'kind.breed',
            });
            return [200, animalKindBreedData];
        });

        return animal.fetch().then(() => {
            expect(animal.id).toBe(1);
            expect(animal.kind.id).toBe(4);
            expect(animal.kind.breed.id).toBe(3);
        });
    });

    test('fetch with camelCased relations', () => {
        const animal = new Animal(
            { id: 2 },
            {
                relations: ['pastOwners'],
            }
        );
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                with: 'past_owners',
            });
            return [200, animalsWithPastOwnersAndTownData];
        });

        return animal.fetch();
    });

    test('fetch with default params', () => {
        const animal = new Animal({ id: 2 });
        animal.setFetchParams({ projectId: 1 });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                with: null,
                projectId: 1,
            });
            return [200, {}];
        });

        return animal.fetch();
    });

    test('fetch with custom buildFetchData', () => {
        const model = new class extends Model {
            api = new BinderApi();
            static backendResourceName = 'resource';

            @observable id = 1;

            buildFetchData(options) {
                return { custom: 'data' };
            }
        }();

        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                custom: 'data'
            });

            return [200, {
                data: {},
            }];
        });

        return model.fetch();
    });


    test('fetch should pass through request options', () => {
        const myApi = new BinderApi();
        mock.onAny().replyOnce(200, {});
        const spy = jest.spyOn(myApi, 'get');

        class Zebra extends Model {
            static backendResourceName = 'zebra';
            api = myApi;
            @observable id = null;
        }

        const zebra = new Zebra({ id: 1 });

        zebra.fetch({ skipRequestErrors: true });
        expect(spy).toHaveBeenCalledWith(
            '/zebra/1/',
            { with: null },
            { skipRequestErrors: true }
        );
    });

    test('fetch with auto-generated URL', () => {
        const kind = new KindResourceName({ id: 2 });
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/kind/2/');
            return [200, {}];
        });

        return kind.fetch();
    });

    test('save new with basic properties', () => {
        const animal = new Animal({ name: 'Doggo' });
        const spy = jest.spyOn(animal, 'saveFromBackend');
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('post');
            expect(config.data).toBe('{"id":-1,"name":"Doggo"}');
            return [201, { id: 10, name: 'Doggo' }];
        });

        return animal.save().then(() => {
            expect(animal.id).toBe(10);
            expect(spy).toHaveBeenCalled();

            spy.mockReset();
            spy.mockRestore();
        });
    });

    test('validate new with basic properties, should not save', () => {
        const animal = new Animal({ name: 'Doggo' });
        const spy = jest.spyOn(animal, 'saveFromBackend');
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('post');
            expect(config.data).toBe('{"id":-1,"name":"Doggo"}');
            return [201, { id: 10, name: 'Doggo' }];
        });

        return animal.validate().then(() => {
            expect(animal.id).toBe(-1);
            expect(spy).not.toHaveBeenCalled();

            spy.mockReset();
            spy.mockRestore();
        });
    });

    test('save existing with basic properties', () => {
        const animal = new Animal({ id: 12, name: 'Burhan' });
        mock.onAny().replyOnce(config => {
            expect(config.method).toBe('patch');
            return [200, { id: 12, name: 'Burhan' }];
        });

        return animal.save().then(() => {
            expect(animal.id).toBe(12);
        });
    });

    test('save fail with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(400, saveFailData);

        return animal.save().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['required'],
                kind: ['blank'],
            });
        });
    });

    test('validation error with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            return [400, saveFailData]
        });

        return animal.validate().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['required'],
                kind: ['blank'],
            });
        });
    });

    test('save new model fail with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(400, saveNewFailData);

        return animal.save().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['invalid'],
            });
        });
    });

    test('save new model validation error with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            return [400, saveNewFailData]
        });

        return animal.validate().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['invalid'],
            });
        });
    });

    test('save fail with 500', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(500, {});

        return animal.save().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({});
        });
    });

    test('validation fail with 500', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            return [500, {}]
        });

        return animal.validate().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({});
        });
    });

    test('save with params', () => {
        const animal = new Animal();
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ branch_id: 1 });
            return [201, {}];
        });

        return animal.save({ params: { branch_id: 1 } });
    });

    test('save with custom data', () => {
        const animal = new Animal();
        mock.onAny().replyOnce(config => {
            expect(JSON.parse(config.data)).toEqual({ id: -1, name: '', extra_data: 'can be saved' });
            return [201, {}];
        });

        return animal.save({ data: { extra_data: 'can be saved' } });
    });

    test('save with mapped data', () => {
        const animal = new Animal();
        mock.onAny().replyOnce(config => {
            expect(JSON.parse(config.data)).toEqual({ id: 'overwritten', name: '' });
            return [201, {}];
        });

        return animal.save({ mapData: data => ({ ...data, id: 'overwritten' }) });
    });

    test('save with custom and mapped data', () => {
        const animal = new Animal();
        mock.onAny().replyOnce(config => {
            expect(JSON.parse(config.data)).toEqual({ id: 'overwritten', name: '', extra_data: 'can be saved' });
            return [201, {}];
        });

        return animal.save({ data: { extra_data: 'can be saved' }, mapData: data => ({ ...data, id: 'overwritten' }) });
    });

    test('save all with relations', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                kind: { name: 'Dog' },
                pastOwners: [{ name: 'Henk' }],
            },
            { relations: ['kind', 'pastOwners'] }
        );
        const spy = jest.spyOn(animal, 'saveFromBackend');
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('put');
            return [201, animalMultiPutResponse];
        });

        return animal.saveAll({ relations: ['kind'] }).then(response => {
            expect(spy).toHaveBeenCalled();
            expect(animal.id).toBe(10);
            expect(animal.kind.id).toBe(4);
            expect(animal.pastOwners.at(0).id).toBe(100);
            expect(response).toEqual(animalMultiPutResponse);

            spy.mockReset();
            spy.mockRestore();
        });
    });

    test('validate all with relations', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                kind: { name: 'Dog' },
                pastOwners: [{ name: 'Henk' }],
            },
            { relations: ['kind', 'pastOwners'] }
        );
        const spy = jest.spyOn(animal, 'saveFromBackend');
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('put');
            return [201, animalMultiPutResponse];
        });

        return animal.validateAll({ relations: ['kind'] }).then(response => {
            expect(spy).not.toHaveBeenCalled();
            expect(animal.id).toBe(10);
            expect(animal.kind.id).toBe(4);
            expect(animal.pastOwners.at(0).id).toBe(100);
            // expect(response).toEqual(animalMultiPutResponse);

            spy.mockReset();
            spy.mockRestore();
        });
    });

    test('save all with relations - verify ids are mapped correctly', () => {
        const animal = new Animal(
            {
                pastOwners: [{ name: 'Henk' }, { id: 125, name: 'Hanos' }],
            },
            { relations: ['pastOwners'] }
        );
        // Sanity check unrelated to the actual test.
        expect(animal.pastOwners.at(0).getInternalId()).toBe(-2);

        mock.onAny().replyOnce(config => {
            return [
                201,
                { idmap: { animal: [[-1, 10]], person: [[-2, 100]] } },
            ];
        });

        return animal.saveAll({ relations: ['pastOwners'] }).then(() => {
            expect(animal.pastOwners.map('id')).toEqual([100, 125]);
        });
    });

    test('save all with validation errors', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                kind: { name: 'Dog' },
                pastOwners: [{ name: 'Jo', town: { id: 5, name: '' } }],
            },
            { relations: ['kind', 'pastOwners.town'] }
        );
        mock.onAny().replyOnce(config => {
            return [400, animalMultiPutError];
        });

        return animal.saveAll({ relations: ['kind'] }).then(
            () => {
            },
            err => {
                if (!err.response) {
                    throw err;
                }
                expect(toJS(animal.backendValidationErrors).name).toEqual([
                    'blank',
                ]);
                expect(toJS(animal.kind.backendValidationErrors).name).toEqual([
                    'required',
                ]);
                expect(
                    toJS(animal.pastOwners.at(0).backendValidationErrors).name
                ).toEqual(['required']);
                expect(
                    toJS(animal.pastOwners.at(0).town.backendValidationErrors)
                        .name
                ).toEqual(['maxlength']);
            }
        );
    });

    test('validate all with errors', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                kind: { name: 'Dog' },
                pastOwners: [{ name: 'Jo', town: { id: 5, name: '' } }],
            },
            { relations: ['kind', 'pastOwners.town'] }
        );
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            return [400, animalMultiPutError];
        });

        return animal.validateAll({ relations: ['kind'] }).then(
            () => {
            },
            err => {
                if (!err.response) {
                    throw err;
                }
                expect(toJS(animal.backendValidationErrors).name).toEqual([
                    'blank',
                ]);
                expect(toJS(animal.kind.backendValidationErrors).name).toEqual([
                    'required',
                ]);
                expect(
                    toJS(animal.pastOwners.at(0).backendValidationErrors).name
                ).toEqual(['required']);
                expect(
                    toJS(animal.pastOwners.at(0).town.backendValidationErrors)
                        .name
                ).toEqual(['maxlength']);
            }
        );
    });

    test('save all with validation errors and check if it clears them', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                pastOwners: [{ name: 'Jo', town: { id: 5, name: '' } }],
            },
            { relations: ['pastOwners.town'] }
        );

        // We first trigger a save with validation errors from the backend, then we trigger a second save which fixes those validation errors,
        // then we check if the errors get cleared.
        mock.onAny().replyOnce(config => {
            return [400, animalMultiPutError];
        });

        const options = { relations: ['pastOwners.town'] };
        return animal.saveAll(options).then(
            () => {
            },
            err => {
                if (!err.response) {
                    throw err;
                }
                mock.onAny().replyOnce(200, { idmap: [] });
                return animal.saveAll(options).then(() => {
                    const valErrors1 = toJS(
                        animal.pastOwners.at(0).backendValidationErrors
                    );
                    expect(valErrors1).toEqual({});
                    const valErrors2 = toJS(
                        animal.pastOwners.at(0).town.backendValidationErrors
                    );
                    expect(valErrors2).toEqual({});
                });
            }
        );
    });

    test('validate all with validation errors and check if it clears them', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                pastOwners: [{ name: 'Jo', town: { id: 5, name: '' } }],
            },
            { relations: ['pastOwners.town'] }
        );

        // We first trigger a save with validation errors from the backend, then we trigger a second save which fixes those validation errors,
        // then we check if the errors get cleared.
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ validate: true });
            return [400, animalMultiPutError];
        });

        const options = { relations: ['pastOwners.town'] };
        return animal.validateAll(options).then(
            () => {
            },
            err => {
                if (!err.response) {
                    throw err;
                }
                mock.onAny().replyOnce(200, { idmap: [] });
                return animal.saveAll(options).then(() => {
                    const valErrors1 = toJS(
                        animal.pastOwners.at(0).backendValidationErrors
                    );
                    expect(valErrors1).toEqual({});
                    const valErrors2 = toJS(
                        animal.pastOwners.at(0).town.backendValidationErrors
                    );
                    expect(valErrors2).toEqual({});
                });
            }
        );
    });

    test('save all with existing model', () => {
        const animal = new Animal(
            { id: 10, name: 'Doggo', kind: { name: 'Dog' } },
            { relations: ['kind'] }
        );
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('put');
            const putData = JSON.parse(config.data);
            expect(putData).toMatchSnapshot();
            return [201, animalMultiPutResponse];
        });

        return animal.saveAll({ relations: ['kind'] });
    });

    test('save all with empty response from backend', () => {
        const animal = new Animal(
            { name: 'Doggo', kind: { name: 'Dog' } },
            { relations: ['kind'] }
        );
        mock.onAny().replyOnce(config => {
            return [201, {}];
        });

        return animal.saveAll();
    });

    test('save all fail', () => {
        const animal = new Animal({});
        mock.onAny().replyOnce(() => {
            return [500, {}];
        });

        const promise = animal.saveAll();
        expect(animal.isLoading).toBe(true);
        return promise.catch(() => {
            expect(animal.isLoading).toBe(false);
        });
    });

    test('delete existing with basic properties', () => {
        const animal = new Animal({ id: 12, name: 'Burhan' });
        mock.onAny().replyOnce(config => {
            expect(config.method).toBe('delete');
            expect(config.url).toBe('/api/animal/12/');
            return [204, null];
        });

        return animal.delete();
    });

    test('delete existing with basic properties and remove from store', () => {
        const animalStore = new AnimalStore().parse([
            { id: 12, name: 'Burhan' },
        ]);
        const animal = animalStore.at(0);
        mock.onAny().replyOnce(config => {
            return [204, null];
        });

        const promise = animal.delete();
        expect(animalStore.at(0)).toBeInstanceOf(Animal);
        return promise.then(() => {
            expect(animalStore.length).toBe(0);
        });
    });

    test('delete existing with basic properties and remove from store without immediate', () => {
        const animalStore = new AnimalStore().parse([
            { id: 12, name: 'Burhan' },
        ]);
        const animal = animalStore.at(0);
        mock.onAny().replyOnce(config => {
            return [204, null];
        });

        expect(animalStore.at(0)).toBeInstanceOf(Animal);
        const promise = animal.delete({ immediate: true });
        expect(animalStore.length).toBe(0);
        return promise;
    });

    test('delete with params', () => {
        const animal = new Animal({ id: 1 });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ branch_id: 1 });
            return [204, null];
        });

        return animal.delete({ params: { branch_id: 1 } });
    });

    test('delete with requestOptions', () => {
        const animal = new Animal({ id: 1 });
        const spy = jest.spyOn(animal.api, 'delete');
        const requestOptions = {
            params: { branch_id: 1 },
            skipRequestErrors: true,
        };

        mock.onAny().replyOnce(config => {
            return [204, null];
        });

        animal.delete(requestOptions);

        expect(spy).toHaveBeenCalledWith(
            '/api/animal/1/',
            null,
            requestOptions
        );
    });

    test('isLoading', () => {
        const animal = new Animal({ id: 2 });
        expect(animal.isLoading).toBe(false);
        mock.onAny().replyOnce(() => {
            expect(animal.isLoading).toBe(true);
            return [200, { id: 2 }];
        });

        return animal.fetch().then(() => {
            expect(animal.isLoading).toBe(false);
        });
    });

    test('isLoading with failed request', () => {
        const animal = new Animal({ id: 2 });

        mock.onAny().replyOnce(() => {
            expect(animal.isLoading).toBe(true);
            return [404];
        });

        return animal.fetch().catch(() => {
            expect(animal.isLoading).toBe(false);
        });
    });

    test('hasUserChanges should clear changes in current fields after save', () => {
        const animal = new Animal({ id: 1 });

        animal.setInput('name', 'Felix');

        mock.onAny().replyOnce(() => {
            // Server returns another name, shouldn't be seen as a change.
            return [200, { id: 1, name: 'Garfield' }];
        });

        return animal.save().then(() => {
            expect(animal.hasUserChanges).toBe(false);
            expect(animal.name).toBe('Garfield');
        });
    });

    test('hasUserChanges should not clear changes in model relations when not saved', () => {
        const animal = new Animal({ id: 1 }, { relations: ['kind.breed'] });

        animal.kind.breed.setInput('name', 'Katachtige');

        mock.onAny().replyOnce(() => {
            return [200, {}];
        });

        return animal.save().then(() => {
            // Because we didn't save the relation, it should return true.
            expect(animal.hasUserChanges).toBe(true);
            expect(animal.kind.hasUserChanges).toBe(true);
            expect(animal.kind.breed.hasUserChanges).toBe(true);
        });
    });

    test('hasUserChanges should clear changes in saved model relations', () => {
        const animal = new Animal({ id: 1 }, { relations: ['kind.breed'] });

        animal.kind.breed.setInput('name', 'Katachtige');

        mock.onAny().replyOnce(() => {
            return [200, {}];
        });

        return animal.saveAll({ relations: ['kind.breed'] }).then(() => {
            expect(animal.hasUserChanges).toBe(false);
        });
    });

    test('hasUserChanges should not clear changes in non-saved models relations', () => {
        const animal = new Animal(
            {
                id: 1, pastOwners: [
                    { id: 2 },
                    { id: 3 },
                ]
            },
            { relations: ['pastOwners', 'kind.breed'] }
        );

        animal.kind.breed.setInput('name', 'Katachtige');
        animal.pastOwners.get(2).setInput('name', 'Zaico');

        mock.onAny().replyOnce(() => {
            return [200, {}];
        });

        return animal.saveAll({ relations: ['kind.breed'] }).then(() => {
            expect(animal.hasUserChanges).toBe(true);
            expect(animal.pastOwners.hasUserChanges).toBe(true);
            expect(animal.pastOwners.get(2).hasUserChanges).toBe(true);
            expect(animal.pastOwners.get(3).hasUserChanges).toBe(false);
        });
    });

    test('hasUserChanges should clear set changes in saved relations', () => {
        const animal = new Animal(
            {
                id: 1, pastOwners: [
                    { id: 2 },
                    { id: 3 },
                ]
            },
            { relations: ['pastOwners', 'kind.breed'] }
        );

        animal.pastOwners.add({});
        expect(animal.hasUserChanges).toBe(true);
        expect(animal.pastOwners.hasUserChanges).toBe(true);

        mock.onAny().replyOnce(() => {
            return [200, {}];
        });

        return animal.saveAll({ relations: ['pastOwners'] }).then(() => {
            expect(animal.pastOwners.hasUserChanges).toBe(false);
            expect(animal.hasUserChanges).toBe(false);
        });
    });

    test('hasUserChanges should not clear set changes in non-saved relations', () => {
        const animal = new Animal(
            {
                id: 1, pastOwners: [
                    { id: 2 },
                    { id: 3 },
                ]
            },
            { relations: ['pastOwners', 'kind.breed'] }
        );

        animal.pastOwners.add({});
        expect(animal.hasUserChanges).toBe(true);
        expect(animal.pastOwners.hasUserChanges).toBe(true);

        mock.onAny().replyOnce(() => {
            return [200, {}];
        });

        return animal.saveAll().then(() => {
            expect(animal.pastOwners.hasUserChanges).toBe(true);
            expect(animal.hasUserChanges).toBe(true);
        });
    });
});

describe('changes', () => {
    test('toBackend should detect changes', () => {
        const animal = new Animal(
            { id: 1, name: 'Lino', kind: { id: 2 } },
            { relations: ['kind'] }
        );
        const output = animal.toBackend({ onlyChanges: true });
        expect(output).toEqual({ id: 1 });

        animal.setInput('name', 'Lion');

        expect(toJS(animal.__changes)).toEqual(['name']);
        const output2 = animal.toBackend({ onlyChanges: true });
        // `kind: 2` should not appear in here.
        expect(output2).toEqual({
            id: 1,
            name: 'Lion',
        });
    });

    test('toBackend should detect changes - but not twice', () => {
        const animal = new Animal({ id: 1 });

        animal.setInput('name', 'Lino');
        animal.setInput('name', 'Lion');
        expect(toJS(animal.__changes)).toEqual(['name']);
        const output = animal.toBackend({ onlyChanges: true });
        expect(output).toEqual({
            id: 1,
            name: 'Lion',
        });
    });

    test('toBackendAll should detect changes', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }, { id: 6, name: 'Piet' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        animal.pastOwners.at(1).setInput('name', 'Jan');
        animal.kind.breed.setInput('name', 'Cat');

        const output = animal.toBackendAll({
            // The `owner` relation is just here to verify that it is not included
            nestedRelations: { kind: { breed: {} }, pastOwners: {} },
            onlyChanges: true,
        });
        expect(output).toEqual({
            data: [{ id: 1, }],
            relations: {
                kind: [
                    {
                        id: 2,
                        breed: -3,
                    },
                ],
                breed: [
                    {
                        id: -3,
                        name: 'Cat',
                    },
                ],
                past_owners: [
                    {
                        id: 6,
                        name: 'Jan',
                    }
                ],
            },
        });
    });

    test('toBackendAll should detect added models', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        animal.pastOwners.add({ id: 6 });

        const output = animal.toBackendAll({
            // The `kind` and `breed` relations are just here to verify that they are not included
            nestedRelations: { kind: { breed: {} }, pastOwners: {} },
            onlyChanges: true,
        });
        expect(output).toEqual({
            data: [{ id: 1, past_owners: [5, 6] }],
            relations: {},
        });
    });


    test('toBackendAll should detect removed models', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }, { id: 6, name: 'Piet' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        animal.pastOwners.removeById(6);

        const output = animal.toBackendAll({
            // The `kind` and `breed` relations are just here to verify that they are not included
            nestedRelations: { kind: { breed: {} }, pastOwners: {} },
            onlyChanges: true,
        });
        expect(output).toEqual({
            data: [{ id: 1, past_owners: [5] }],
            relations: {},
        });
    });


    test('toBackendAll without onlyChanges should serialize all relations', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    breed: { name: 'Cat' },
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );
        const output = animal.toBackendAll({
            nestedRelations: { kind: { breed: {} }, pastOwners: {} },
            onlyChanges: false,
        });
        expect(output).toEqual({
            data: [{
                id: 1,
                name: 'Lino',
                kind: 2,
                owner: null,
                past_owners: [5]
            }],
            relations: {
                kind: [
                    {
                        id: 2,
                        breed: -3,
                        name: '',
                    },
                ],
                breed: [
                    {
                        id: -3,
                        name: 'Cat',
                    },
                ],
                past_owners: [{
                    id: 5,
                    name: 'Henk'
                }],
            },
        });
    });

    test('hasUserChanges should detect changes in current fields', () => {
        const animal = new Animal({ id: 1 });
        expect(animal.hasUserChanges).toBe(false);

        animal.setInput('name', 'Lino');
        expect(animal.hasUserChanges).toBe(true);
    });

    test('hasUserChanges should detect changes in model relations', () => {
        const animal = new Animal({ id: 1 }, { relations: ['kind.breed'] });
        expect(animal.hasUserChanges).toBe(false);

        animal.kind.breed.setInput('name', 'Katachtige');
        expect(animal.hasUserChanges).toBe(true);
    });

    test('hasUserChanges should detect changes in store relations', () => {
        const animal = new Animal(
            { id: 1, pastOwners: [{ id: 1 }] },
            { relations: ['pastOwners'] }
        );

        expect(animal.hasUserChanges).toBe(false);

        animal.pastOwners.at(0).setInput('name', 'Henk');

        expect(animal.hasUserChanges).toBe(true);
    });
});


test('copy (with changes)', () => {
    const customer = new Customer(null, {
        relations: ['oldTowns.bestCook.workPlaces'],
    });

    customer.fromBackend({
        data: customersWithTownCookRestaurant.data,
        repos: customersWithTownCookRestaurant.with,
        relMapping: customersWithTownCookRestaurant.with_mapping,
    });


    customer.oldTowns.models[0].bestCook.workPlaces.models[0].setInput('name', "Italian");

    const customerCopyWithChanges = new Customer();
    customerCopyWithChanges.copy(customer)

    // Clone with changes should give the same toBackend result as the cloned object
    expect(customerCopyWithChanges.toBackendAll({ onlyChanges: true })).toEqual(customer.toBackendAll({ onlyChanges: true }))
});

test('copy (with changes without instantiating model)', () => {
    const customer = new Customer(null, {
        relations: ['oldTowns.bestCook.workPlaces'],
    });

    customer.fromBackend({
        data: customersWithTownCookRestaurant.data,
        repos: customersWithTownCookRestaurant.with,
        relMapping: customersWithTownCookRestaurant.with_mapping,
    });


    customer.oldTowns.models[0].bestCook.workPlaces.models[0].setInput('name', "Italian");

    const customerCopyWithChanges = customer.copy({ copyChanges: true })

    // Clone with changes should give the same toBackend result as the cloned object
    expect(customerCopyWithChanges.toBackendAll({ onlyChanges: true })).toEqual(customer.toBackendAll({ onlyChanges: true }))
});

test('copy (without instantiating model)', () => {
    const customer = new Customer(null, {
        relations: ['oldTowns.bestCook.workPlaces'],
    });

    customer.fromBackend({
        data: customersWithTownCookRestaurant.data,
        repos: customersWithTownCookRestaurant.with,
        relMapping: customersWithTownCookRestaurant.with_mapping,
    });


    customer.oldTowns.models[0].bestCook.workPlaces.models[0].setInput('name', "Italian");

    const customerCopyWithChanges = customer.copy()

    // Clone with changes should give the same toBackend result as the cloned object
    expect(customerCopyWithChanges.toBackendAll({ onlyChanges: true })).toEqual(customer.toBackendAll({ onlyChanges: true }))
});

test('copy (without changes)', () => {
    const customer = new Customer(null, {
        relations: ['oldTowns.bestCook.workPlaces'],
    });

    customer.fromBackend({
        data: customersWithTownCookRestaurant.data,
        repos: customersWithTownCookRestaurant.with,
        relMapping: customersWithTownCookRestaurant.with_mapping,
    });

    customer.oldTowns.models[0].bestCook.workPlaces.models[0].setInput('name', "Italian");

    const customerCopyNoChanges = new Customer();
    customerCopyNoChanges.copy(customer, { copyChanges: true })


    // Clone without changes should give the same toBackend result as the cloned object when only changes is false
    expect(customerCopyNoChanges.toBackendAll({ onlyChanges: false })).toEqual(customer.toBackendAll({ onlyChanges: false }))
});

test('copy with store relation', () => {
    const animal = new Animal({}, { relations: ['pastOwners'] });

    animal.pastOwners.parse([
        { name: 'Bar' },
        { name: 'Foo' },
        { id: 10, name: 'R' },
    ]);

    [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {

        let serialized = copiedAnimal.toBackendAll({ nestedRelations: { pastOwners: {} } });
        let expected = animal.toBackendAll({ nestedRelations: { pastOwners: {} } });
        compareObjectsIgnoringNegativeIds(serialized, expected, expect)

        const animalAlternativeCopy = new Animal();
        animalAlternativeCopy.copy(animal);

        serialized = copiedAnimal.toBackendAll({ nestedRelations: { pastOwners: {} } });
        expected = animal.toBackendAll({ nestedRelations: { pastOwners: {} } });
        compareObjectsIgnoringNegativeIds(serialized, expected, expect)
    });
});

test('de-duplicate relations should not work after copy', () => {
    const animal = new Animal({}, { relations: ['pastOwners.town'] });

    animal.pastOwners.parse([{ name: 'Bar' }, { name: 'Foo' }]);

    // This is something you should never do, so maybe this is a bad test?
    const animalBar = animal.pastOwners.at(0);
    animal.pastOwners.models[1] = animalBar;

    // This isn't the real test, just a check.
    expect(animalBar.cid).toBe(animal.pastOwners.at(1).cid);

    [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {

        let serialized = copiedAnimal.toBackendAll({
            nestedRelations: { pastOwners: { town: {} } },
        });
        let expected = animal.toBackendAll({
            nestedRelations: { pastOwners: { town: {} } },
        });
        // We should not copy cid's therefore it should not equal expected
        compareObjectsIgnoringNegativeIds(serialized, expected, expect, false)
    });
});

test('copy with deep nested relation', () => {
    // It's very important to test what happens when the same relation ('location') is used twice + is nested.
    const animal = new Animal(
        {},
        { relations: ['kind.location', 'kind.breed.location'] }
    );

    animal.kind.parse({
        name: 'Aap',
        location: { name: 'Apenheul' },
        breed: { name: 'MyBreed', location: { name: 'Amerika' } },
    });

    [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {

        const expected = animal.toBackendAll({
            nestedRelations: { kind: { location: {}, breed: { location: {} } } },
        });
        const serialized = copiedAnimal.toBackendAll({
            nestedRelations: { kind: { location: {}, breed: { location: {} } } },
        });
        compareObjectsIgnoringNegativeIds(serialized, expected, expect)
    });
});

test('copy with nested store relation', () => {
    // It's very important to test what happens when the same relation ('location') is used twice + is nested.
    const animal = new Animal({}, { relations: ['pastOwners.town'] });

    animal.pastOwners.parse([
        {
            name: 'Henk',
            town: {
                name: 'Eindhoven',
            },
        },
        {
            name: 'Krol',
            town: {
                name: 'Breda',
            },
        },
    ]);

    [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {


        const expected = animal.toBackendAll({
            nestedRelations: { pastOwners: { town: {} } },
        });
        const serialized = copiedAnimal.toBackendAll({
            nestedRelations: { pastOwners: { town: {} } },
        });
        compareObjectsIgnoringNegativeIds(serialized, expected, expect)
    });
});

test('toBackendAll with `backendResourceName` property model', () => {
    const animal = new AnimalResourceName(
        {},
        { relations: ['blaat', 'owners', 'pastOwners'] }
    );

    animal.parse({
        id: 1,
        blaat: {
            id: 2,
        },
        owners: [
            {
                id: 3,
            },
        ],
        pastOwners: [
            {
                id: 4,
            },
        ],
    });

    const copiedAnimal = animal.copy();
    const expected = animal.toBackendAll({
        nestedRelations: { blaat: {}, owners: {}, pastOwners: {} },
    });
    const serialized = copiedAnimal.toBackendAll({
        nestedRelations: { blaat: {}, owners: {}, pastOwners: {} },
    });
    compareObjectsIgnoringNegativeIds(serialized, expected, expect)

});

describe('copy with changes', () => {
    test('toBackend of copy should detect changes', () => {
        const animal = new Animal(
            { id: 1, name: 'Lino', kind: { id: 2 } },
            { relations: ['kind'] }
        );

        const output = animal.toBackend({ onlyChanges: true });
        expect(output).toEqual({ id: 1 });

        animal.setInput('name', 'Lion');

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {

            expect(toJS(copiedAnimal.__changes)).toEqual(['name']);
            const output2 = copiedAnimal.toBackend({ onlyChanges: true });
            // `kind: 2` should not appear in here.
            expect(output2).toEqual({
                id: 1,
                name: 'Lion',
            });
        });
    });

    test('toBackend should detect changes - but not twice', () => {
        const animal = new Animal({ id: 1 });

        animal.setInput('name', 'Lino');
        animal.setInput('name', 'Lion');

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(toJS(copiedAnimal.__changes)).toEqual(['name']);
            const output = copiedAnimal.toBackend({ onlyChanges: true });
            expect(output).toEqual({
                id: 1,
                name: 'Lion',
            });
        })
    });

    test('toBackendAll should detect changes', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }, { id: 6, name: 'Piet' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        animal.pastOwners.at(1).setInput('name', 'Jan');
        animal.kind.breed.setInput('name', 'Cat');

        const output = animal.toBackendAll({
            // The `owner` relation is just here to verify that it is not included
            nestedRelations: { kind: { breed: {} }, pastOwners: {} },
            onlyChanges: true,
        });
        expect(output).toEqual({
            data: [{ id: 1, }],
            relations: {
                kind: [
                    {
                        id: 2,
                        breed: -3,
                    },
                ],
                breed: [
                    {
                        id: -3,
                        name: 'Cat',
                    },
                ],
                past_owners: [
                    {
                        id: 6,
                        name: 'Jan',
                    }
                ],
            },
        });
    });

    test('toBackendAll should detect added models', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        animal.pastOwners.add({ id: 6 });

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {

            const output = copiedAnimal.toBackendAll({
                // The `kind` and `breed` relations are just here to verify that they are not included
                nestedRelations: { kind: { breed: {} }, pastOwners: {} },
                onlyChanges: true,
            });
            expect(output).toEqual({
                data: [{ id: 1, past_owners: [5, 6] }],
                relations: {},
            });
        });
    });


    test('toBackendAll should detect removed models', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }, { id: 6, name: 'Piet' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        animal.pastOwners.removeById(6);

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {

            const output = copiedAnimal.toBackendAll({
                // The `kind` and `breed` relations are just here to verify that they are not included
                nestedRelations: { kind: { breed: {} }, pastOwners: {} },
                onlyChanges: true,
            });
            expect(output).toEqual({
                data: [{ id: 1, past_owners: [5] }],
                relations: {},
            });
        });
    });


    test('toBackendAll without onlyChanges should serialize all relations', () => {
        const animal = new Animal(
            {
                id: 1,
                name: 'Lino',
                kind: {
                    id: 2,
                    breed: { name: 'Cat' },
                    owner: { id: 4 },
                },
                pastOwners: [{ id: 5, name: 'Henk' }],
            },
            { relations: ['kind.breed', 'owner', 'pastOwners'] }
        );

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal, index) => {
            const output = copiedAnimal.toBackendAll({
                nestedRelations: { kind: { breed: {} }, pastOwners: {} },
                onlyChanges: false,
            });
            expect(output).toEqual({
                data: [{
                    id: 1,
                    name: 'Lino',
                    kind: 2,
                    owner: null,
                    past_owners: [5]
                }],
                relations: {
                    kind: [
                        {
                            id: 2,
                            // We don't care that our other copy gets a different id, as long as they are not the same
                            breed: index === 0 ? -8 : -13,
                            name: '',
                        },
                    ],
                    breed: [
                        {
                            id: index === 0 ? -8 : -13 ,
                            name: 'Cat',
                        },
                    ],
                    past_owners: [{
                        id: 5,
                        name: 'Henk'
                    }],
                },
            });
        });
    });

    test('hasUserChanges should detect changes in current fields', () => {
        const animal = new Animal({ id: 1 });
        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(copiedAnimal.hasUserChanges).toBe(false);
        });

        animal.setInput('name', 'Lino');
        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(copiedAnimal.hasUserChanges).toBe(true);
        });
    });

    test('hasUserChanges should detect changes in model relations', () => {
        const animal = new Animal({ id: 1 }, { relations: ['kind.breed'] });
        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(copiedAnimal.hasUserChanges).toBe(false);
        });

        animal.kind.breed.setInput('name', 'Katachtige');
        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(copiedAnimal.hasUserChanges).toBe(true);
        });
    });

    test('hasUserChanges should detect changes in store relations', () => {
        const animal = new Animal(
            { id: 1, pastOwners: [{ id: 1 }] },
            { relations: ['pastOwners'] }
        );

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(copiedAnimal.hasUserChanges).toBe(false);
        });

        animal.pastOwners.at(0).setInput('name', 'Henk');

        // Should work for both copy methods
        [animal.copy(), new Animal().copy(animal)].forEach((copiedAnimal) => {
            expect(copiedAnimal.hasUserChanges).toBe(true);
        });
    });
});

describe('negative id instead of null', () => {

    test('new model instance should have a negative id instead of null', () => {
        const animal = new Animal();
        expect(animal.id).toBeLessThan(0);
    });

    test('new model instance should have a null id instead of negative when supplied in data', () => {
        const animal = new Animal({ id: null });
        expect(animal.id).toBeNull();
    });

    test('new model instance should not have negative id if a positive id was supplied in data', () => {
        const animal = new Animal({ id: 5 });
        expect(animal.id).toBe(5);
    });

    test('new model should keep negative id on clear', () => {
        const animal = new Animal();
        animal.clear();
        expect(animal.id).toBeLessThan(0);
    });

    test('new model should keep null id on clear when created with id null', () => {
        const animal = new Animal({id: null});
        animal.clear();
        expect(animal.id).toBeNull();
    });

    test('new model should keep negative id on clear, when created with an id', () => {
        const animal = new Animal({id: 5});
        animal.clear();
        expect(animal.id).toBeLessThan(0);
    });

    test('related model should get null id if not initialized', () => {
        const animal = new Animal({id: 5}, {relations: ['kind']});

        expect(animal.kind.id).toBeNull();
    });

    test('related model should get null id on clear', () => {
        const animal = new Animal({id: 5, kind: {id: 5}}, {relations: ['kind']});

        expect(animal.kind.id).toBe(5);
        animal.clear();
        expect(animal.kind.id).toBeNull();
    });

    test('related model should get null id on related model clear', () => {
        const animal = new Animal({id: 5, kind: {id: 5}}, {relations: ['kind']});

        expect(animal.kind.id).toBe(5);
        animal.kind.clear();
        expect(animal.kind.id).toBeNull();
    });

    test('model initialized with null should get negative id when clearing after copy', () => {
        const animal = new Animal({id: null});

        const copiedAnimal = animal.copy()
        copiedAnimal.clear();
        expect(copiedAnimal.id).toBeLessThan(0);
    });

    test('model should get negative id when clearing after copy', () => {
        const animal = new Animal();

        const copiedAnimal = animal.copy()
        copiedAnimal.clear();
        expect(copiedAnimal.id).toBeLessThan(0);
    });

    test('model should get null id when clearing after copy if it is instantiated with a null id', () => {
        const animal = new Animal();

        const copiedAnimal = new Animal({id: null});
        copiedAnimal.copy(animal)
        copiedAnimal.clear();
        expect(copiedAnimal.id).toBeNull();
    });

    test('related model should get null id on clear after copy', () => {
        const animal = new Animal({ id: 5, kind: { id: 5 } }, { relations: ['kind'] });

        const copiedAnimal = animal.copy()
        copiedAnimal.clear();
        expect(copiedAnimal.kind.id).toBeNull();
    });

    test('copying a related model should get a negative id when clear() is called on copied model', () => {
        const animal = new Animal({ id: 5, kind: { id: 5 } }, { relations: ['kind'] });

        const copiedKind = animal.kind.copy()
        copiedKind.clear();
        expect(copiedKind.id).toBeLessThan(0);
    });

});
