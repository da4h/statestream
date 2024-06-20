import { Publisher } from '../publisher/Publisher';

export enum ConnectionState {
  Available,
  Unavailable,
}

export abstract class Connector {
  protected subscriptions: { [key: string]: Publisher<any> } = {};

  private _state = new Publisher<ConnectionState>();
  public get state() {
    return this._state;
  }

  protected constructor() {
    this.state.publish(ConnectionState.Unavailable);
  }

  public abstract connect(options: object);

  public subscribe(key: string): Publisher<any> {
    if (!this.subscriptions.hasOwnProperty(key)) {
      this.subscriptions[key] = new Publisher<any>();
    }

    return this.subscriptions[key];
  }

  public abstract publish(key: string, publisher: Publisher<any>);
}
