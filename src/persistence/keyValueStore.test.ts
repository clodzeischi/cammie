import { createBrowserStore } from './keyValueStore';

describe('createBrowserStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('reads and writes localStorage', () => {
    const store = createBrowserStore();
    store.set('k', 'v');
    expect(window.localStorage.getItem('k')).toBe('v');
    expect(store.get('k')).toBe('v');
    store.remove('k');
    expect(store.get('k')).toBeNull();
  });

  it('never throws when storage is blocked or full', () => {
    const fail = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(fail);

    const store = createBrowserStore();
    expect(store.get('k')).toBeNull();
    expect(() => store.set('k', 'v')).not.toThrow();
    expect(() => store.remove('k')).not.toThrow();
  });
});
