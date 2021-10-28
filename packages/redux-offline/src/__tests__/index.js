import { applyMiddleware, combineReducers, compose, createStore } from 'redux';
import { KEY_PREFIX } from 'redux-persist/lib/constants';
import instrument from 'redux-devtools-instrument';
import { createOffline } from '../index';

const storageKey = `${KEY_PREFIX}offline`;
const defaultReducer = (state = {}) => state;
const noop = () => {};

let defaultConfig;
beforeEach(() => {
  defaultConfig = {
    effect: jest.fn(() => Promise.resolve())
  };
});

test('createOffline() creates storeEnhancer', () => {
  const { middleware, enhanceReducer, enhanceStore } =
    createOffline(defaultConfig);
  const reducer = enhanceReducer(defaultReducer);
  const store = createStore(
    reducer,
    compose(applyMiddleware(middleware), enhanceStore)
  );
  expect(store.dispatch).toEqual(expect.any(Function));
  expect(store.getState).toEqual(expect.any(Function));
});

test('createOffline() supports HMR', () => {
  const { middleware, enhanceReducer, enhanceStore } =
    createOffline(defaultConfig);
  const reducer = enhanceReducer(defaultReducer);
  const store = createStore(
    reducer,
    compose(applyMiddleware(middleware), enhanceStore)
  );
  store.replaceReducer(
    combineReducers({
      data: defaultReducer
    })
  );
  store.dispatch({ type: 'SOME_ACTION' });
  expect(store.getState()).toHaveProperty('offline');
});

// see https://github.com/redux-offline/redux-offline/issues/4
test('restores offline outbox when rehydrates', (done) => {
  const actions = [
    {
      type: 'SOME_OFFLINE_ACTION',
      meta: { offline: { effect: {} } }
    }
  ];
  defaultConfig.persistOptions.storage.setItem(
    storageKey,
    JSON.stringify({ outbox: actions }),
    noop
  );

  const store = offline({
    ...defaultConfig,
    persistCallback() {
      const {
        offline: { outbox }
      } = store.getState();
      expect(outbox).toEqual(actions);
      done();
    }
  })(createStore)(defaultReducer);
});

// see https://github.com/jevakallio/redux-offline/pull/91
test('works with devtools store enhancer', () => {
  const { middleware, enhanceReducer, enhanceStore } =
    createOffline(defaultConfig);
  const monitorReducer = (state) => state;
  const reducer = enhanceReducer(defaultReducer);
  const store = createStore(
    reducer,
    compose(
      applyMiddleware(middleware),
      enhanceStore,
      instrument(monitorReducer)
    )
  );

  expect(() => {
    store.dispatch({ type: 'SOME_ACTION' });
  }).not.toThrow();
});

// there were some reports that this might not be working correctly
test('coming online processes outbox', () => {
  const { middleware, enhanceReducer, enhanceStore, _instance } =
    createOffline(defaultConfig);
  const reducer = enhanceReducer(defaultReducer);
  const store = createStore(
    reducer,
    compose(applyMiddleware(middleware), enhanceStore)
  );

  expect(store.getState().offline.online).toBe(false);
  const action = { type: 'REQUEST', meta: { offline: { effect: {} } } };
  store.dispatch(action);
  expect(defaultConfig.effect).not.toBeCalled();

  _instance.offlineSideEffects.setPaused(false);
  expect(store.getState().offline.online).toBe(true);
  expect(defaultConfig.effect).toBeCalled();
});
