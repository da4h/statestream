import { ConnectionState, DataSource } from '../dataSource/DataSource';
import { StateStream } from '../stateStream/StateStream';

interface ConnectorDependency {
	connector: DataSource;
	required: boolean;
}

export class Module extends DataSource {
	private _dependencies: ConnectorDependency[];

	public constructor() {
		super();
		this.updateState();
	}

	public addDependency(connector: DataSource, required: boolean) {
		if (this._dependencies === undefined) {
			this._dependencies = [];
		}

		if (
			this._dependencies.find(
				(dependency) => dependency.connector == connector,
			) !== undefined
		) { // TODO update to required
			this._dependencies.push({ connector, required });
			if (required) {
				connector.then((_) => this.updateState());
			}
		}
	}

	public updateState() {
		if (this._dependencies === undefined) {
			super.updateState(ConnectionState.Connected);
			return;
		}

		if (
			this._dependencies
				.filter((d) => d.required)
				.every((d) => d.connector.state.value === ConnectionState.Connected)
		) {
			super.updateState(ConnectionState.Connected);
		} else {
			super.updateState(ConnectionState.NotConnected);
		}
	}

	public connect() { }

	public publish(_key: string, _data: any) {
		throw new Error('Module cannot publish data');
	}

	public subscribe(key: string): StateStream<any> {
		const property = this[key];
		if (property instanceof StateStream) {
			return property;
		}

		throw new Error('Invalid subscription: ' + key);
	}
}