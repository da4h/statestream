import { IStream as IPublisher } from "./IPublisher";

// TODO: switch if unavailable / whenUnavailable(..)
export class Publisher<T> implements IPublisher<T> {
    private _onNext:((value: T) => void)[] = [];
    private _onEmpty:(() => void)[] = [];
    private _onError:((error: Error) => void)[] = [];
    private _value:T = undefined;

    public get value() { return this._value; }

    public publish(value:T | Error):void {
        if (value instanceof Error) {
            for(let subscriber of this._onError) {
                subscriber(value);
            }
        } else if (value === undefined || value === null) {
            this._value = value;
            for(let subscriber of this._onEmpty) {
                subscriber();
            }
        } else {
            this._value = value;
            for(let subscriber of this._onNext) {
                subscriber(value);
            }
        }
    }

    public subscribe(subscriber: (value: T) => void) {
        this._onNext.push(subscriber);
    }

    public onError(subscriber: (error: Error) => void) {
        this._onError.push(subscriber);
    }

    public onEmpty(subscriber: () => void) {
        this._onEmpty.push(subscriber);
    }

    private _changed: Publisher<T> = null;
    public changed(): Publisher<T> {
        if (this._changed === null) {
            this._changed = this.createStream<T>();
            this._changed.publish(this._value);
            this.onEmpty(() => this._changed.publish(undefined));
            this.onError(e => this._changed.publish(e));
            this.subscribe(value => {
                if (value !== this._changed.value) {
                    this._changed.publish(value);
                }
            });
        }

        return this._changed;
    }

    public switchIfEmpty(value: T | (() => T)): Publisher<T> {
        let publisher = this.createStream<T>();
        this.subscribe(v => publisher.publish(v));
        this.onError(e => publisher.publish(e));
        this.onEmpty(() => {
            if (this.isCallback<() => T>(value)) {
                publisher.publish(value());
            } else {
                publisher.publish(value);
            }
        })
        return publisher;
    }

    public map<U>(transformation: ((value: T) => U)): Publisher<U> {
        let publisher = this.createStream<U>();
        this.onError(e => publisher.publish(e));
        this.onEmpty(() => publisher.publish(undefined));
        this.subscribe(event => {
            publisher.publish(transformation(event));
        });
        return publisher;
    }

    public filter(filter: ((value: T) => Boolean)): Publisher<T> {
        let publisher = this.createStream<T>();
        this.onError(e => publisher.publish(e));
        this.onEmpty(() => publisher.publish(undefined));
        this.subscribe(value => {
            if (filter(value))
                publisher.publish(value);
        });
        return publisher;
    }

    public noPublishSince(ms: number): Publisher<T> {
        let publisher = this.createStream<T>();
        this.onError(e => publisher.publish(e));
        this.onEmpty(() => publisher.publish(undefined));
        let timeout = null;
        this.subscribe(value => {
            if (timeout !== null) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                publisher.publish(value);
            }, ms);
        });
        return publisher;
    }

    public static of<T>(...streams: Publisher<T>[]):Publisher<T> {
        let publisher = new Publisher<T>();
        streams.forEach(s => s.subscribe(value => publisher.publish(value)));
        return publisher;
    }

    public static ofMap<T>(map: { [key: string]: Publisher<any> }): Publisher<{ [key: string]: T }> {
        let publisher = new Publisher<{[key: string]: T}>();
        for (let key in map) {
            map[key].subscribe(event => {
                let value = {};
                for (let k in map) {
                    value[k] = map[k].value;
                }
                publisher.publish(value);
            });
        }

        return publisher;
    }

    public static ofArray<T>(...streams: Publisher<T>[]): Publisher<T[]> {
        let publisher = new Publisher<T[]>();
        streams.forEach(s => s.subscribe(event => publisher.publish(streams.map(s => s.value))));
        return publisher;
    }

    public static mergeConditionally<T>(...streams: { if: Publisher<boolean>, then: Publisher<T> }[]): Publisher<T[]> {
        let publisher = new Publisher<T[]>();
        Publisher.of<any>(...streams.map(s => s.if).concat(streams.map(s => s.then as Publisher<any>)))
            .subscribe(() => {
                publisher.publish(streams.filter(s => s.if.value).map(s => s.then.value));
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