import { ConnectionState, Connector } from "./Connector";
import { Publisher } from "./Publisher";

export function bind(opts: {connector: Connector, key: string, required?: boolean}) {
    return function attachDecorator(module: any, propertyKey: string) {
        module.addDependency(opts.connector, opts.required === undefined ? true : opts.required);

        let publisher = opts.connector.subscribe(opts.key ? opts.key : propertyKey);
        Object.defineProperty(module, propertyKey, {
            get() {
                return publisher;
            },
            enumerable: true,
            configurable: false,
            }
        );
    }
};

export function expose(opts: {connector: Connector, key: string}) {
    return function attachDecorator(module: any, propertyKey: string) {

        let publisher = new Publisher<any>();
        publisher.subscribe(value => opts.connector.publish(opts.key, value));
        Object.defineProperty(module, propertyKey, {
            get() {
                return publisher;
            },
            enumerable: true,
            configurable: false,
            }
        );
    }
};

interface ConnectorDependency {
    connector: Connector;
    required: boolean;
}

export class Module extends Connector {
    private _dependencies: ConnectorDependency[];

    public constructor() {
        super();
        this.dependencyStateChanged();
    }

    public addDependency(connector: Connector, required: boolean) {
        if (this._dependencies === undefined) {
            this._dependencies = [];
        }

        if (this._dependencies.find(dependency => dependency.connector == connector) !== undefined) {
            this._dependencies.push({connector, required});
            if (required) {
                connector.state.changed().subscribe(_ => this.dependencyStateChanged());
            }
        }
    }

    private dependencyStateChanged() {
        if (this.state.value === ConnectionState.Available) {
            if (this._dependencies.filter(d => d.required).some(d => d.connector.state.value === ConnectionState.Unavailable)) {
                this.state.publish(ConnectionState.Unavailable);
            }
        }

        if (this.state.value === ConnectionState.Unavailable) {
            if (this._dependencies.filter(d => d.required).every(d => d.connector.state.value === ConnectionState.Available)) {
                this.state.publish(ConnectionState.Available);
            }
        }
    }

    public connect() {}

    public publish(key: string, data: any) {
        throw new Error("Module cannot publish data");
    }

    public subscribe(key: string): Publisher<any> {
        let property = this[key];
        if (property instanceof Publisher) {
            return property;
        }

        throw new Error("Invalid subscription: " + key);
    }
}
/*
    - Preload
        - steps:
            - Load persisted data
            - Get retained data from connectors
        `onInitialized`
    
    - Start:
        `onStarted`

    - Required connection go down:
        `onStopped`
    
    ?? stream could be active | inactive ? inactive until start, inactivate on stop
        inactive stream wont publish changes

    ?? onStarted == onInitialized
*/