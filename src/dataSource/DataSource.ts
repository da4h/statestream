import { StateStream } from '../stateStream/StateStream';

export enum ConnectionState {
  Initializing,
  Connected,
  NotConnected,
}

export abstract class DataSource extends StateStream<ConnectionState> {
  protected subscriptions: { [key: string]: StateStream<any> } = {};

  protected constructor() {
    super();
    this.updateState(ConnectionState.Initializing);
  }

  public abstract connect(options: object);

  public subscribe(key: string): StateStream<any> {
    if (this.state?.value !== ConnectionState.Initializing) {
      throw new Error("Subscribing not allowed after the initialization state");
    }

    if (!this.subscriptions.hasOwnProperty(key)) {
      this.subscriptions[key] = new StateStream<any>();
    }

    return this.subscriptions[key];
  }

  public abstract publish(key: string, publisher: StateStream<any>);
}
