export class State<T> {

  constructor(public readonly value: T | undefined, public readonly error: Error | undefined = undefined, public readonly at: Date = new Date()) {
  }

  public isEmpty(): boolean {
    return !this.isError() && this.value === undefined;
  }

  public isError(): boolean {
    return this.error !== undefined;
  }
}

export class StateChange<T> {

  constructor(public readonly from: State<T> | undefined, public readonly to: State<T> | undefined) {
  }

  public isInitialChange(): boolean {
    return this.from === undefined;
  }

  public isTerminalChange(): boolean {
    return this.to === undefined;
  }

  public isChanged(): boolean {
    return JSON.stringify(this.from?.value) !== JSON.stringify(this.to?.value);
  }
}