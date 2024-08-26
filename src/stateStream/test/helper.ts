import { StateChange } from "../State";

export function expectToBeCalledWith(callback, expectedStateChange: StateChange<string>) {
    let stateChange: StateChange<string> = callback.mock.calls[callback.mock.calls.length -1][0];

    if (expectedStateChange.from === undefined) {
        expect(stateChange.from).toBeUndefined();
    } else {
        expect(stateChange.from.error).toEqual(expectedStateChange.from.error);
        expect(stateChange.from.value).toBe(expectedStateChange.from.value);
    }

    expect(stateChange.to.error).toEqual(expectedStateChange.to.error);
    expect(stateChange.to.value).toBe(expectedStateChange.to.value);
}