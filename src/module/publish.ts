import { DataSource } from '../dataSource/DataSource';
import { StateStream } from '../stateStream/StateStream';

export function publish(opts: { connector: DataSource; key: string }) {
	return function attachDecorator(module: any, propertyKey: string) {
		const publisher = new StateStream<any>();
		opts.connector.publish(opts.key, publisher);
		Object.defineProperty(module, propertyKey, {
			get() {
				return publisher;
			},
			enumerable: true,
			configurable: false,
		});
	};
}
