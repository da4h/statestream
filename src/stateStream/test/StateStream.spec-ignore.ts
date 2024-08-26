import { StateStream } from '../StateStream';
import each from 'jest-each';

jest.useFakeTimers();

describe('Publisher', () => {
  let source: StateStream<string> = null;
  let result: string = null;

  beforeEach(() => {
    source = new StateStream<string>();
    result = undefined;
  });

  it('publish', async () => {
    source.subscribe((i) => (result = i));

    source.updateState('ok');

    expect(source.value).toBe('ok');
    expect(result).toBe('ok');
  });

  it('publish empty', async () => {
    source.onEmpty(() => (result = 'empty'));

    source.updateState('prev');
    expect(source.value).toBe('prev');

    source.updateState(undefined);

    expect(source.value).toBe(undefined);
    expect(result).toBe('empty');
  });

  it('publish error', async () => {
    source.onError((_) => (result = 'error'));

    source.updateState('prev');
    expect(source.value).toBe('prev');

    source.updateState(new Error());

    expect(source.value).toBe('prev');
    expect(result).toBe('error');
  });

  describe('switchIfEmpty', () => {
    each([
      ['const', false],
      ['function', true],
    ]).describe('argument - %s', (_, isFunction) => {
      let publisher = null;

      beforeEach(() => {
        if (isFunction) {
          publisher = source.switchIfEmpty(() => 'switched');
        } else {
          publisher = source.switchIfEmpty('switched');
        }
      });

      it('publish on parent', async () => {
        publisher.subscribe((i) => (result = i));

        source.updateState('ok');

        expect(publisher.value).toBe('ok');
        expect(result).toBe('ok');
      });

      it('publish empty on parent', async () => {
        publisher.subscribe((i) => (result = i));

        source.updateState(undefined);

        expect(publisher.value).toBe('switched');
        expect(result).toBe('switched');
      });

      it('publish error on parent', async () => {
        publisher.onError((_) => (result = 'error'));

        source.updateState(new Error());

        expect(publisher.value).toBe(undefined);
        expect(result).toBe('error');
      });
    });
  });

  describe('changed', () => {
    let changed = null;
    let counter;

    beforeEach(() => {
      changed = source.changed();
      counter = 0;
    });

    it('publish on parent', async () => {
      changed.subscribe((_) => counter++);

      source.updateState('ok');

      expect(changed.value).toBe('ok');
      expect(counter).toBe(1);

      source.updateState('ok');

      expect(changed.value).toBe('ok');
      expect(counter).toBe(1);
    });

    it('publish empty on parent', async () => {
      changed.subscribe((_) => counter++);
      changed.onEmpty(() => (result = 'empty'));

      source.updateState('ok');
      expect(changed.value).toBe('ok');
      expect(counter).toBe(1);

      source.updateState(undefined);
      expect(changed.value).toBe(undefined);
      expect(result).toBe('empty');
      expect(counter).toBe(1);
    });

    it('publish error on parent', async () => {
      changed.subscribe((_) => counter++);
      changed.onError((_) => (result = 'error'));

      source.updateState('ok');
      expect(changed.value).toBe('ok');
      expect(counter).toBe(1);

      source.updateState(new Error());
      expect(changed.value).toBe('ok');
      expect(result).toBe('error');
      expect(counter).toBe(1);
    });
  });

  describe('map', () => {
    let publisher = null;

    beforeEach(() => {
      publisher = source.map((v) => v + v);
    });

    it('publish on parent', async () => {
      publisher.subscribe((i) => (result = i));

      source.updateState('ok');

      expect(publisher.value).toBe('okok');
      expect(result).toBe('okok');
    });

    it('publish empty on parent', async () => {
      publisher.onEmpty(() => (result = 'empty'));

      source.updateState('ok');
      expect(publisher.value).toBe('okok');

      source.updateState(undefined);
      expect(publisher.value).toBe(undefined);
      expect(result).toBe('empty');
    });

    it('publish error on parent', async () => {
      publisher.onError((_) => (result = 'error'));

      source.updateState('ok');
      expect(publisher.value).toBe('okok');

      source.updateState(new Error());
      expect(publisher.value).toBe('okok');
      expect(result).toBe('error');
    });
  });

  describe('filter', () => {
    let publisher = null;

    beforeEach(() => {
      publisher = source.filter((v) => v === 'ok');
    });

    it('publish on parent', async () => {
      publisher.subscribe((i) => (result = i));

      source.updateState('ok');

      expect(publisher.value).toBe('ok');
      expect(result).toBe('ok');

      source.updateState('nok');

      expect(publisher.value).toBe('ok');
      expect(result).toBe('ok');
    });

    it('publish empty on parent', async () => {
      publisher.onEmpty(() => (result = 'empty'));

      source.updateState('ok');
      expect(publisher.value).toBe('ok');

      source.updateState(undefined);
      expect(publisher.value).toBe(undefined);
      expect(result).toBe('empty');
    });

    it('publish error on parent', async () => {
      publisher.onError((_) => (result = 'error'));

      source.updateState('ok');
      expect(publisher.value).toBe('ok');

      source.updateState(new Error());
      expect(publisher.value).toBe('ok');
      expect(result).toBe('error');
    });
  });

  describe('noPublishSince', () => {
    let publisher = null;

    beforeEach(() => {
      publisher = source.noPublishSince(100);
    });

    it('publish on parent', async () => {
      publisher.subscribe((i) => (result = i));

      source.updateState('ok');
      expect(publisher.value).toBe(undefined);
      expect(result).toBe(undefined);

      jest.runAllTimers();
      expect(publisher.value).toBe('ok');
      expect(result).toBe('ok');
    });

    it('publish empty on parent', async () => {
      publisher.onEmpty(() => (result = 'empty'));

      source.updateState(undefined);
      expect(publisher.value).toBe(undefined);
      expect(result).toBe('empty');
    });

    it('publish error on parent', async () => {
      publisher.onError((_) => (result = 'error'));

      source.updateState('ok');
      expect(publisher.value).toBe(undefined);

      jest.runAllTimers();
      expect(publisher.value).toBe('ok');

      source.updateState(new Error());
      expect(publisher.value).toBe('ok');
      expect(result).toBe('error');
    });
  });
});
