import { DataSource } from '../dataSource/DataSource';

export function subscribe(opts: {
	connector: DataSource;
	key: string;
	required?: boolean;
}) {
	return function attachDecorator(module: any, propertyKey: string) {
		module.addDependency(
			opts.connector,
			opts.required === undefined ? true : opts.required,
		);

		const publisher = opts.connector.subscribe(
			opts.key ? opts.key : propertyKey,
		);
		Object.defineProperty(module, propertyKey, {
			get() {
				return publisher;
			},
			enumerable: true,
			configurable: false,
		});
	};
}
