import { State, StateChange } from "./State";

type StateChangeListener<T> = (stateChange: StateChange<T>) => void;
type StateChangeTransformation<T, U> = (stateChange: StateChange<T>) => U

export class StateStream<T> {
  private _onNext: (StateChangeListener<T>)[] = [];
  private _onEmpty: (StateChangeListener<T>)[] = [];
  private _onError: (StateChangeListener<T>)[] = [];

  private _previousState: State<T> = undefined;
  private _state: State<T> = undefined;

  public isInitialized(): boolean {
    return this._state !== undefined;
  }

  public get state(): State<T> {
    return this._state;
  }

  // region Subscription handling

  public updateState(value: T | Error | undefined | State<T>): void {
    let state: State<T>;
    if (value instanceof State) {
      state = value;
    } else {
      if (value instanceof Error || value?.constructor.name === "Error") {
        state = new State(undefined, value as any);
      } else {
        state = new State(value);
      }
    }
    if (!state.isError() || !this._state?.isError()) {
      this._previousState = this._state;
    }

    this._state = state;

    let stateChange = new StateChange(this._previousState, this._state);
    if (this._state.isEmpty()) {
      for (const subscriber of this._onEmpty) {
        subscriber(stateChange);
      }
    } else if(this._state.isError()) {
      for (const subscriber of this._onError) {
        subscriber(stateChange);
      }
    } else {
      for (const subscriber of this._onNext) {
        subscriber(stateChange);
      }
    }
  }

  public then(subscriber: StateChangeListener<T> | StateStream<T>): StateStream<T> {
    if (this.isCallback<(stateChange: StateChange<T>) => T>(subscriber)) {
      this._onNext.push(subscriber);
    } else if (subscriber instanceof StateStream) {
      this._onNext.push(stateChange => subscriber.updateState(stateChange.to));
    } else {
      throw new Error("Invalid subscrier: " + typeof subscriber);
    }

    return this;
  }

  public onError(subscriber: StateChangeListener<T> | StateStream<any>): StateStream<T> {
    if (this.isCallback<StateChangeListener<T>>(subscriber)) {
      this._onError.push(subscriber);
    } else if (subscriber instanceof StateStream) {
      this._onError.push(stateChange => subscriber.updateState(stateChange.to));
    } else {
      throw new Error("Invalid subscrier: " + typeof subscriber);
    }

    return this;
  }

  public onEmpty(subscriber: StateChangeListener<T> | StateStream<any>): StateStream<T> {
    if (this.isCallback<StateChangeListener<T>>(subscriber)) {
      this._onEmpty.push(subscriber);
    } else if (subscriber instanceof StateStream) {
      this._onEmpty.push(stateChange => subscriber.updateState(stateChange.to));
    } else {
      throw new Error("Invalid subscrier: " + typeof subscriber);
    }

    return this;
  }

  // endregion

  private _changed: StateStream<T> = null;
  public changed(): StateStream<T> {
    if (this._changed === null) {
      this._changed = this.createStream<T>();
      this._changed._changed = this._changed;
      this.onError(this._changed);
      this.onEmpty(this._changed);
      this.then((stateChange) => {
        if (stateChange.isChanged()) {
          this._changed.updateState(stateChange.to.value);
        }
      });
    }

    return this._changed;
  }


  // region Transformations

  public switchIfEmpty(
    value: T | StateChangeTransformation<T, T>,
  ): StateStream<T> {
    const publisher = this.createStream<T>();
    this.then(publisher);
    this.onError(publisher);
    this.onEmpty((stateChange) => {
      if (this.isCallback<StateChangeTransformation<T, T>>(value)) {
        publisher.updateState(value(stateChange));
      } else {
        publisher.updateState(value);
      }
    });
    return publisher;
  }

  public map<U>(transformation: StateChangeTransformation<T, U>): StateStream<U> {
    const publisher = this.createStream<U>();
    this.onError(publisher);
    this.onEmpty(publisher);
    this.then((stateChange) => {
      publisher.updateState(transformation(stateChange));
    });
    return publisher;
  }

  public extract<U>(key: string): StateStream<U> {
    const publisher = this.createStream<U>();
    this.onError(publisher);
    this.onEmpty(publisher);
    this.then((stateChange) => {
      publisher.updateState(stateChange.to.value[key]);
    });
    return publisher;
  }

  public filter(
    filter: StateChangeTransformation<T, boolean>,
  ): StateStream<T> {
    const publisher = this.createStream<T>();
    this.onError(publisher);
    this.onEmpty(publisher);
    this.then(stateChange => {
      if (filter(stateChange)) publisher.updateState(stateChange.to);
    });
    return publisher;
  }

  public debounce(ms: number): StateStream<T> {
    const publisher = this.createStream<T>();
    this.onError(publisher);
    this.onEmpty(publisher);
    let timeout = null;
    this.then((stateChange) => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        publisher.updateState(stateChange.to);
      }, ms);
    });
    return publisher;
  }

  public debounceIf(filter: StateChangeTransformation<T, boolean>, ms: number): StateStream<T> {
    const publisher = this.createStream<T>();
    this.onError(publisher);
    this.onEmpty(publisher);
    let timeout = null;
    this.then((stateChange) => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (filter(stateChange)) {
        timeout = setTimeout(() => {
          publisher.updateState(stateChange.to);
        }, ms);
      } else {
        publisher.updateState(stateChange.to);
      }
    });
    return publisher;
  }
  // endregion

  // region static builders

  public static any<T>(...streams: StateStream<T>[]): StateStream<T> {
    const publisher = new StateStream<T>();
    streams.forEach((s) => s.then((stateChange) => publisher.updateState(stateChange.to.value)));
    return publisher;
  }

  public static mergeMap<T extends {[key: string]: StateStream<any>}>(map: T): StateStream<{ [key in keyof T]: any }> {
    const publisher = new StateStream<{ [key in keyof T]: any }>();
    for (const key in map) { // TODO error and empty handling
      map[key].then((_) => {
        const value: { [key in keyof T]: any } = {} as any;
        for (const k in map) {
          value[k] = map[k].state.value;
        }
        publisher.updateState(value);
      });
    }

    return publisher;
  }

  public static merge<T>(...streams: StateStream<T>[]): StateStream<T[]> {
    const publisher = new StateStream<T[]>();
    streams.forEach((stream) => // TODO error and empty handling
      stream.then((_) => publisher.updateState(streams.map((s) => stream.state?.value as T))),
    );
    return publisher;
  }

  public static mergeConditionally<T>(
    ...streams: { if: StateStream<boolean>; then: StateStream<T> }[]
  ): StateStream<T[]> {
    const publisher = new StateStream<T[]>();
    StateStream.any<any>(
      ...streams
        .map((s) => s.if)
        .concat(streams.map((stream) => stream.then as StateStream<any>)),
    ).then(() => {
      publisher.updateState( // TODO error and empty handling
        streams.filter((stream) => stream.if.state?.value).map((s) => s.then.state?.value as T),
      );
    });
    return publisher;
  }
  // endregion

  protected createStream<T>(): StateStream<T> {
    return new StateStream<T>();
  };

  private isCallback<T>(source: T | unknown): source is T {
    return typeof source === 'function';
  }
}
