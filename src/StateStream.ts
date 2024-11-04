export type Subscriber<T> = StateChangeListener<T> | Publisher<T>;
export type StateChangeListener<T> = (data: T, change: StateChange<T>) => void;
type StateChangeTransformation<T, U> = (data: T, change: StateChange<T>) => U

export class State<T> {
  constructor(public readonly value: T = undefined, public readonly at: Date = new Date()) {}
  public isEmpty(): boolean { return this.value === undefined; }
}

export class StateChange<T> {
  constructor(public readonly from: State<T>, public readonly to: State<T>) {}
  public isInitialChange(): boolean { return this.from === undefined; }
  public isChanged(): boolean { return JSON.stringify(this.from?.value) !== JSON.stringify(this.to?.value); }
}

export default class Publisher<T> {
  private _onNext: (StateChangeListener<T>)[] = [];
  private _previousState: State<T> = undefined;
  private _state: State<T> = undefined;

  public isInitialized(): boolean { return this._state !== undefined; }
  public get state(): State<T> { return this._state; }
  public get value(): T { return this._state?.value; }

  public publish(value: T | State<T>): void {
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

    this._state = state;

    let change = new StateChange(this._previousState, this._state);
    for (const subscriber of this._onNext) {
      subscriber(change.to.value, change);
    }
  }

  public subscribe(subscriber: Subscriber<T>): Publisher<T> {
    if (this.isCallback<(data: T, change: StateChange<T>) => T>(subscriber)) {
      this._onNext.push(subscriber);
      subscriber(this._state.value, new StateChange(this._previousState, this.state));
    } else if (subscriber instanceof Publisher) {
      this._onNext.push((_, change) => subscriber.publish(change.to));
      subscriber.publish(this._state);
    } else {
      throw new Error("Invalid subscrier: " + typeof subscriber);
    }

    return this;
  }

  public filter(): StreamFilter<T> {
    return new StreamFilter(this);
  }

  public map(): StreamMapping<T> {
    return new StreamMapping(this);
  }

  public debounce(params?: DebounceParameters): StreamDebounce<T> {
    return new StreamDebounce(this, params);
  }

  public signal(params?: SignalParameters): StreamSignal<T> {
    return new StreamSignal(this, params);
  }

  public extract<U extends keyof T>(key: U): Publisher<T[U]> {
    const publisher = this.createStream<T[U]>();
    this.subscribe((_, change) => {
      if (change.to.value.hasOwnProperty(key))
        publisher.publish(change.to.value[key]);
    });
    return publisher;
  }

  public join<PublisherMap extends object, U>(
    map: {[key in keyof PublisherMap]: Publisher<PublisherMap[key]>}, 
    transform: StateChangeTransformation<(PublisherMap&{this: Publisher<T>}), U>
  ): Publisher<U> {
    return Publisher.join<PublisherMap>({...map, this: this}).map().by(transform);
  }

  public flatMap<U>(transform: StateChangeTransformation<T, Publisher<U>>): Publisher<U> {
    const publisher = this.createStream<U>();
    let prevStream = undefined;
    let subscriber = (data, change) => publisher.publish(change.to);

    this.subscribe((data, change) => {
      let nextStream = transform(data, change);
      if (prevStream === nextStream) return;

      if (prevStream !== undefined) {
        let index = prevStream._onNext.indexOf(subscriber);
        if (index !== -1) {
          prevStream._onNext.splice(index, 1);
        }
      }

      if (nextStream !== undefined) {
        nextStream.subscribe(subscriber);
      }
    });

    return publisher;
  }

  public static join<T extends object>(map: {[key in keyof T]: Publisher<T[key]>}): Publisher<T> {
    const publisher = new Publisher<{ [key in keyof T]: any }>();
    for (const key in map) {
      map[key].subscribe((_) => {
        const value: { [key in keyof T]: any } = {} as any;
        for (const k in map) {
          value[k] = map[k].state?.value;
        }

        if (Object.values(map).map((s: Publisher<any>) => s.isInitialized()).every(x => x)) {
          publisher.publish(value);
        }
      });
    }

    const value: { [key in keyof T]: any } = {} as any;
    let hasUndefined = false;
    for (const k in map) {
      value[k] = map[k].state?.value;
      hasUndefined = hasUndefined || value[k] === undefined;
    }

    if (!hasUndefined) {
      publisher.publish(value);
    }

    return publisher;
  }

  public static of<T>(...streams: Publisher<T>[]): Publisher<T[]> {
    const publisher = new Publisher<T[]>();
    streams.forEach((stream) =>
      stream.subscribe((_) => {
        let newState = streams.map((s) => s.state?.value as T);
        if (streams.map(s => s.isInitialized()).every(x => x))
          publisher.publish(newState)
      }));
    let newState = streams.map((s) => s.state?.value as T);
    if (!newState.some(x => x === undefined))
    publisher.publish(newState)
    return publisher;
  }

  public static anyOf(...streams: Publisher<boolean>[]): Publisher<boolean> {
    return Publisher.of<boolean>(...streams).map().by(data => data.some(x => x));
  }

  public static allOf(...streams: Publisher<boolean>[]): Publisher<boolean> {
    return Publisher.of<boolean>(...streams).map().by(data => data.every(x => x));
  }

  public static just<T>(data: T): Publisher<T>
  {
    const publisher = new Publisher<T>();
    publisher.publish(data);
    return publisher;
  }

  public createStream<T>(): Publisher<T> {
    return new Publisher<T>();
  };

  protected isCallback<T>(source: T | unknown): source is T {
    return typeof source === 'function';
  }
}

class StreamOperation<T> {
  constructor(protected readonly stream: Publisher<T>){}

  public createStream<T>(): Publisher<T> {
    return this.stream.createStream<T>();
  };

  public subscribe(subscriber: Subscriber<T>): Publisher<T> {
    return this.stream.subscribe(subscriber);
  }

  protected isCallback<T>(source: T | unknown): source is T {
    return typeof source === 'function';
  }
}

class StreamFilter<T> extends StreamOperation<T> {
  public by(filter: StateChangeTransformation<T, boolean>): Publisher<T> {
    const publisher = this.createStream<T>();
    this.subscribe((data, change) => {
      if (filter(data, change)) publisher.publish(change.to);
    });

    return publisher;
  }

  public byPublisher(enableSignal: Publisher<boolean>): Publisher<T> {
    const publisher = this.createStream<T>();
    this.subscribe((data, change) => {
      if (enableSignal.value === true)
        publisher.publish(data);
    });
    enableSignal.subscribe(data => {
      if (this.stream.isInitialized() && data === true) publisher.publish(this.stream.value);
    });
    return publisher;
  }

  public changes(): Publisher<T> {
    let publisher = this.createStream<T>();
    this.subscribe((_, change) => {
      if (change.isChanged()) publisher.publish(change.to.value);
    });

    return publisher;
  }

  public nonInitialChanges(): Publisher<T> {
    let publisher = this.createStream<T>();
    this.subscribe((_, change) => {
      if (!change.isInitialChange() && change.isChanged()) publisher.publish(change.to.value);
    });

    return publisher;
  }

  public nonEmpty(): Publisher<T> {
    let publisher = this.createStream<T>();
    this.subscribe((_, change) => {
      if (!change.to.isEmpty()) publisher.publish(change.to.value);
    });

    return publisher;
  }
}

class StreamMapping<T> extends StreamOperation<T> {
  public by<U>(transformation: StateChangeTransformation<T, U>): Publisher<U> {
    const publisher = this.createStream<U>();
    this.subscribe((data, change) => {
      publisher.publish(transformation(data, change));
    });
    return publisher;
  }

  public toBoolean(value: boolean): Publisher<boolean> {
    const publisher = this.createStream<boolean>();
    this.subscribe((data, change) => {
      publisher.publish(value);
    });
    return publisher;
  }

  public nonInitialChanges(): Publisher<StateChange<T>> {
    return this.stream
      .filter().changes()
      .map().by((data, change) => change)
      .filter().by(data => !data.isInitialChange());
  }

  public empty(
    value: T | StateChangeTransformation<T, T>,
  ): Publisher<T> {
    const publisher = this.createStream<T>();
    this.subscribe((data, change) => {
      if (!change.to.isEmpty()) {
        publisher.publish(change.to);
      } else {
        if (this.isCallback<StateChangeTransformation<T, T>>(value)) {
          publisher.publish(value(data, change));
        } else {
          publisher.publish(value);
        }
      }
    });
    return publisher;
  }
}

export type DebounceParameters = { ms: number; };
class StreamDebounce<T> extends StreamOperation<T> {
  constructor(stream: Publisher<T>, private readonly parameters: DebounceParameters){ super(stream); }

  public by(filter: StateChangeTransformation<T, boolean>): Publisher<T> {
    const publisher = this.createStream<T>();
    let timeout = null;
    this.subscribe((data, change) => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (!change.isInitialChange() && filter(data, change)) {
        timeout = setTimeout(() => {
          publisher.publish(change.to);
        }, this.parameters?.ms || 1000);
      } else {
        publisher.publish(change.to);
      }
    });
    return publisher;
  }

  public all(): Publisher<T> {
    const publisher = this.createStream<T>();
    let timeout = null;
    this.subscribe((data, change) => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (!change.isInitialChange()) {
        timeout = setTimeout(() => {
          publisher.publish(change.to);
        }, this.parameters?.ms || 1000);
      } else {
        publisher.publish(change.to);
      }
    });
    return publisher;
  }
}

// Note: triggers ignore initial changes
export type SignalParameters = {
  signalLength: number;
}
class StreamSignal<T> extends StreamOperation<T> {
  constructor(stream: Publisher<T>, private readonly parameters: SignalParameters){ super(stream); }

  public reset(fallbackValue?: T): Publisher<T> {
    const publisher = this.createStream<T>();
    let timeout = null;
    this.subscribe((_, change) => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        publisher.publish(fallbackValue);
      }, this.parameters.signalLength || 1);
      publisher.publish(change.to);
    });
    return publisher;
  }

  public whenChanged(): Publisher<boolean> {
    return this.stream
      .filter().nonInitialChanges()
      .map().toBoolean(true)
      .signal(this.parameters).reset()
      .map().empty(false);
  }

  public hysteresis<T extends number>(low: T, high: T): Publisher<boolean> {
    return this.stream
      .filter().by(data => (data as number) < low || (data as number) > high)
      .map().by(data => (data as number) > high);
  }
}

/*

  math()
    - min
    - max
    - average
*/
