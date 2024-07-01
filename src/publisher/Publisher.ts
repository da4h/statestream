import { IStream as IPublisher } from './IPublisher';

// TODO: switch if unavailable / whenUnavailable(..)
export class Publisher<T> implements IPublisher<T> {
  private _onNext: ((actual: T, previous: T, previousAt: Date) => void)[] = [];
  private _onEmpty: ((previous: T, previousAt: Date) => void)[] = [];
  private _onError: ((error: Error) => void)[] = [];
  private _value: T = undefined;
  private _at: Date = undefined;

  public get value() {
    return this._value;
  }

  public get at() {
    return this._at;
  }

  public publish(value: T | Error): void {
    if (value instanceof Error) {
      for (const subscriber of this._onError) {
        subscriber(value);
      }
    } else if (value === undefined || value === null) {
      let previous = this._value;
      let previousAt = this._at;
      // TODO reconsider this
      this._value = value;
      this._at = new Date();
      for (const subscriber of this._onEmpty) {
        subscriber(previous, previousAt);
      }
    } else {
      let previous = this._value;
      let previousAt = this._at;
      this._value = value;
      this._at = new Date();
      for (const subscriber of this._onNext) {
        subscriber(value, previous, previousAt);
      }
    }
  }

  public subscribe(subscriber: (actual: T, previous: T, previousAt: Date) => void) {
    this._onNext.push(subscriber);
  }

  public onError(subscriber: (error: Error) => void) {
    this._onError.push(subscriber);
  }

  public onEmpty(subscriber: (previous: T, previousAt: Date) => void) {
    this._onEmpty.push(subscriber);
  }

  private _changed: Publisher<T> = null;
  public changed(): Publisher<T> {
    if (this._changed === null) {
      this._changed = this.createStream<T>();
      this._changed.publish(this._value);
      this.onEmpty(() => this._changed.publish(undefined));
      this.onError((e) => this._changed.publish(e));
      this.subscribe((value, previous) => {
        if (value !== previous) {
          this._changed.publish(value);
        }
      });
    }

    return this._changed;
  }

  public switchIfEmpty(value: T | ((previous: T, previousAt: Date) => T)): Publisher<T> {
    const publisher = this.createStream<T>();
    this.subscribe((v) => publisher.publish(v));
    this.onError((e) => publisher.publish(e));
    this.onEmpty((previous, previousAt) => {
      if (this.isCallback<(previous: T, previousAt: Date) => T>(value)) {
        publisher.publish(value(previous, previousAt));
      } else {
        publisher.publish(value);
      }
    });
    return publisher;
  }

  public map<U>(transformation: (value: T) => U): Publisher<U> {
    const publisher = this.createStream<U>();
    this.onError((e) => publisher.publish(e));
    this.onEmpty(() => publisher.publish(undefined));
    this.subscribe((event) => {
      publisher.publish(transformation(event));
    });
    return publisher;
  }

  public filter(filter: (value: T, previous: T, previousAt: Date) => boolean): Publisher<T> {
    const publisher = this.createStream<T>();
    this.onError((e) => publisher.publish(e));
    this.onEmpty(() => publisher.publish(undefined));
    this.subscribe((value, previous, previousAt) => {
      if (filter(value, previous, previousAt)) publisher.publish(value);
    });
    return publisher;
  }

  public noPublishSince(ms: number): Publisher<T> {
    const publisher = this.createStream<T>();
    this.onError((e) => publisher.publish(e));
    this.onEmpty(() => publisher.publish(undefined));
    let timeout = null;
    this.subscribe((value) => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        publisher.publish(value);
      }, ms);
    });
    return publisher;
  }

  public static of<T>(...streams: Publisher<T>[]): Publisher<T> {
    const publisher = new Publisher<T>();
    streams.forEach((s) => s.subscribe((value) => publisher.publish(value)));
    return publisher;
  }

  public static ofMap<T>(map: {
    [key: string]: Publisher<any>;
  }): Publisher<{ [key: string]: T }> {
    const publisher = new Publisher<{ [key: string]: T }>();
    for (const key in map) {
      map[key].subscribe((_) => {
        const value = {};
        for (const k in map) {
          value[k] = map[k].value;
        }
        publisher.publish(value);
      });
    }

    return publisher;
  }

  public static ofArray<T>(...streams: Publisher<T>[]): Publisher<T[]> {
    const publisher = new Publisher<T[]>();
    streams.forEach((s) =>
      s.subscribe((_) => publisher.publish(streams.map((s) => s.value))),
    );
    return publisher;
  }

  public static mergeConditionally<T>(
    ...streams: { if: Publisher<boolean>; then: Publisher<T> }[]
  ): Publisher<T[]> {
    const publisher = new Publisher<T[]>();
    Publisher.of<any>(
      ...streams
        .map((s) => s.if)
        .concat(streams.map((s) => s.then as Publisher<any>)),
    ).subscribe(() => {
      publisher.publish(
        streams.filter((s) => s.if.value).map((s) => s.then.value),
      );
    });
    return publisher;
  }

  protected createStream<Target>(): Publisher<Target> {
    return new Publisher<Target>();
  }

  private isCallback<T>(source: T | unknown): source is T {
    return typeof source === 'function';
  }
}
