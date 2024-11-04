import { State, StateChange } from '../State';
import { StateStream } from '../StateStream';
import each from 'jest-each';
import { expectToBeCalledWith } from './helper';

jest.useFakeTimers();

describe('StateStream - Changed', () => {
  let stateStream: StateStream<string> = null;
  let cbData = jest.fn(stateChange => {});
  let cbEmpty = jest.fn(stateChange => {});
  let cbError = jest.fn(stateChange => {});

  beforeEach(() => {
    stateStream = new StateStream<string>();
    stateStream.changed()
      .then(cbData)
      .onEmpty(cbEmpty)
      .onError(cbError);
    cbData.mockReset();
    cbEmpty.mockReset();
    cbError.mockReset();
  });

  describe('data', () => {
    it('first', async () => {
      stateStream.updateState('data');
  
      expect(cbEmpty).not.toHaveBeenCalled();
      expect(cbError).not.toHaveBeenCalled();
      expectToBeCalledWith(cbData, new StateChange(undefined, new State("data")));  
    });

    it('repeated', async () => {
      stateStream.updateState('data');
      expect(cbData).toHaveBeenCalledTimes(1);

      stateStream.updateState('data');
      expect(cbData).toHaveBeenCalledTimes(1);

      expect(cbEmpty).not.toHaveBeenCalled();
      expect(cbError).not.toHaveBeenCalled();
      expectToBeCalledWith(cbData, new StateChange(undefined, new State("data")));  
    });

    it('changed', async () => {
      stateStream.updateState('data');
      stateStream.updateState('data2');

      expect(cbEmpty).not.toHaveBeenCalled();
      expect(cbError).not.toHaveBeenCalled();
      expectToBeCalledWith(cbData, new StateChange(new State("data"), new State("data2")));  
    });
  })

  it('empty', async () => {
    stateStream.updateState(undefined);

    expect(cbData).not.toHaveBeenCalled();
    expect(cbError).not.toHaveBeenCalled();
    expectToBeCalledWith(cbEmpty, new StateChange(undefined, new State(undefined)));

    expect(stateStream.state.value).toBeUndefined();
  });

  it('error', async () => {
    stateStream.updateState(new Error("error"));

    expect(cbData).not.toHaveBeenCalled();
    expect(cbEmpty).not.toHaveBeenCalled();
    expectToBeCalledWith(cbError, new StateChange(undefined, new State(undefined, new Error("error"))));

    expect(stateStream.state.error).toEqual(new Error("error"));
  });
});
